"""
Rebuild ChromaDB RAG knowledge base from:
  1. 100% ESConv dataset (all conversations, no split)
  2. EPITOME Reddit level=2 examples (ER, IP, EX)

Emotion labels normalized from ESConv format to SoulMate format.
"""

import os
import sys
import shutil
import io
import csv
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import json
from pathlib import Path
from datasets import load_dataset
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


DB_PATH         = "./chroma_db"
COLLECTION_NAME = "soulmate_knowledge_base"
EMBEDDING_MODEL = "text-embedding-3-small"
BATCH_SIZE      = 200

# ESConv label -> SoulMate label
EMOTION_MAP = {
    "anxiety":    "anxious",
    "sadness":    "sad",
    "anger":      "angry",
    "fear":       "fearful",
    "depression": "depressed",
    "shame":      "ashamed",
    "disgust":    "disgust",
}

EPITOME_DIR = Path(__file__).parent.parent / "data" / "epitome"
EPITOME_FILES = {
    "er": EPITOME_DIR / "emotional-reactions-reddit.csv",
    "ip": EPITOME_DIR / "interpretations-reddit.csv",
    "ex": EPITOME_DIR / "explorations-reddit.csv",
}


def load_esconv_docs(splitter):
    """Load 100% ESConv and return (docs, emotion_counts)."""
    print("Loading ESConv from HuggingFace...")
    ds = load_dataset("thu-coai/esconv")
    full_data = ds["train"]
    print(f"Using all {len(full_data)} conversations for RAG")

    docs = []
    emotion_counts = {}

    for row in full_data:
        try:
            conv = json.loads(row["text"])
        except (json.JSONDecodeError, KeyError):
            continue

        dialog    = conv.get("dialog", [])
        problem   = conv.get("problem_type", "unknown")
        situation = conv.get("situation", "")

        raw_emotion = conv.get("emotion_type", "neutral").lower().strip()
        emotion     = EMOTION_MAP.get(raw_emotion, raw_emotion)

        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

        current_seeker = None

        for utt in dialog:
            speaker = utt.get("speaker", "")
            text    = utt.get("text", "").strip()

            if not text:
                continue

            if speaker == "usr":
                current_seeker = text

            elif speaker == "sys" and current_seeker:
                response = text
                strategy = utt.get("strategy", "Others")

                page_content = (
                    f"SEEKER: {current_seeker} | "
                    f"EMOTION: {emotion} | "
                    f"PROBLEM: {problem} | "
                    f"STRATEGY: {strategy}"
                )

                metadata = {
                    "response":            response,
                    "emotion":             emotion,
                    "original_transcript": current_seeker,
                    "source":              "esconv",
                    "strategy":            strategy,
                    "problem_type":        problem,
                    "situation":           situation,
                    "traits_str":          "",
                }

                if len(response) > 512:
                    chunks = splitter.split_text(response)
                    for chunk in chunks:
                        docs.append(Document(
                            page_content=page_content,
                            metadata={**metadata, "response": chunk}
                        ))
                else:
                    docs.append(Document(
                        page_content=page_content,
                        metadata=metadata
                    ))

                current_seeker = None

    print(f"\nESConv emotion distribution:")
    for emo, count in sorted(emotion_counts.items()):
        print(f"   {emo:<12} -> {count} conversations")

    return docs


def load_epitome_docs():
    """Load EPITOME Reddit level=2 rows and return (docs, counts_per_type)."""
    counts = {"er": 0, "ip": 0, "ex": 0}
    docs = []

    for empathy_type, filepath in EPITOME_FILES.items():
        if not filepath.exists():
            print(f"WARNING: {filepath} not found, skipping.")
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("level", "").strip() != "2":
                    continue

                seeker_post  = row.get("seeker_post", "").strip()
                response_post = row.get("response_post", "").strip()

                if not seeker_post or not response_post:
                    continue

                page_content = (
                    f"SEEKER: {seeker_post} | "
                    f"SOURCE: EPITOME | "
                    f"TYPE: {empathy_type}"
                )

                metadata = {
                    "response":            response_post,
                    "emotion":             "mental_health",
                    "original_transcript": seeker_post,
                    "source":              "epitome",
                    "empathy_type":        empathy_type,
                    "strategy":            "epitome_level2",
                    "traits_str":          "",
                }

                docs.append(Document(
                    page_content=page_content,
                    metadata=metadata
                ))
                counts[empathy_type] += 1

    return docs, counts


def build_rag():
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=64,
        separators=["\n\n", "\n", ". ", " "],
    )

    # -- 1. Load ESConv --
    esconv_docs = load_esconv_docs(splitter)

    # -- 2. Load EPITOME --
    epitome_docs, epitome_counts = load_epitome_docs()

    # -- 3. Combine --
    all_docs = esconv_docs + epitome_docs

    # -- 4. Reset ChromaDB --
    if os.path.exists(DB_PATH):
        shutil.rmtree(DB_PATH)
        print("\nDeleted old ChromaDB")

    embedding_model = OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        api_key=os.environ.get("OPENAI_API_KEY")
    )

    vector_db = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embedding_model,
        persist_directory=DB_PATH
    )

    # -- 5. Upload --
    print(f"\nUploading to ChromaDB (batch={BATCH_SIZE})...")
    for i in range(0, len(all_docs), BATCH_SIZE):
        batch = all_docs[i : i + BATCH_SIZE]
        vector_db.add_documents(batch)
        uploaded = min(i + BATCH_SIZE, len(all_docs))
        print(f"   {uploaded}/{len(all_docs)} chunks...")

    # -- 6. Stats --
    print(f"\n{'='*50}")
    print(f"  ESConv chunks      : {len(esconv_docs)}")
    print(f"  EPITOME ER level=2 : {epitome_counts['er']}")
    print(f"  EPITOME IP level=2 : {epitome_counts['ip']}")
    print(f"  EPITOME EX level=2 : {epitome_counts['ex']}")
    print(f"  Total              : {len(all_docs)}")
    print(f"{'='*50}")
    print(f"  Collection : {COLLECTION_NAME}")
    print(f"  Location   : {DB_PATH}")


if __name__ == "__main__":
    build_rag()
