"""
Rebuild ChromaDB RAG knowledge base from ESConv training set.
Uses turn-pair chunking: each seeker->supporter pair is one chunk.
First 80% of ESConv = training set (last 20% is reserved for benchmark test).

Emotion labels are normalized from ESConv format to SoulMate format:
  anxiety    -> anxious
  sadness    -> sad
  anger      -> angry
  fear       -> anxious
  depression -> sad
  shame      -> sad
"""

import os
import sys
import shutil
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import json
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
    "fear":       "anxious",
    "depression": "sad",
    "shame":      "sad",
    "disgust":    "disgust",
}


def build_rag():
    # -- 1. Load ESConv training set --
    print("Loading ESConv from HuggingFace...")
    ds = load_dataset("thu-coai/esconv")
    full_data  = ds["train"]
    train_size = int(len(full_data) * 0.8)
    train_data = full_data.select(range(train_size))
    print(f"Using {train_size} conversations for RAG")

    # -- 2. Reset ChromaDB --
    if os.path.exists(DB_PATH):
        shutil.rmtree(DB_PATH)
        print("Deleted old ChromaDB")

    embedding_model = OpenAIEmbeddings(
        model=EMBEDDING_MODEL,
        api_key=os.environ.get("OPENAI_API_KEY")
    )

    vector_db = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=embedding_model,
        persist_directory=DB_PATH
    )

    # -- 3. Text splitter for long supporter responses --
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=512,
        chunk_overlap=64,
        separators=["\n\n", "\n", ". ", " "],
    )

    # -- 4. Build documents --
    docs = []
    emotion_counts = {}

    for row in train_data:
        # ESConv stores each conversation as a JSON string in 'text' field
        try:
            conv = json.loads(row["text"])
        except (json.JSONDecodeError, KeyError):
            continue

        dialog    = conv.get("dialog", [])
        problem   = conv.get("problem_type", "unknown")
        situation = conv.get("situation", "")

        # Get ESConv emotion and normalize to SoulMate label
        raw_emotion = conv.get("emotion_type", "neutral").lower().strip()
        emotion     = EMOTION_MAP.get(raw_emotion, raw_emotion)

        # Track distribution
        emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

        current_seeker = None

        for utt in dialog:
            speaker = utt.get("speaker", "")
            text    = utt.get("text", "").strip()

            if not text:
                continue

            # ESConv uses "usr" for seeker and "sys" for supporter
            if speaker == "usr":
                current_seeker = text

            elif speaker == "sys" and current_seeker:
                response = text
                strategy = utt.get("strategy", "Others")

                # Rich page_content for semantic search
                page_content = (
                    f"SEEKER: {current_seeker} | "
                    f"EMOTION: {emotion} | "
                    f"PROBLEM: {problem} | "
                    f"STRATEGY: {strategy}"
                )

                metadata = {
                    "response":            response,
                    "emotion":             emotion,       # SoulMate label
                    "original_transcript": current_seeker,
                    "strategy":            strategy,
                    "problem_type":        problem,
                    "situation":           situation,
                    "traits_str":          "",
                }

                # Split long responses if needed
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

    print(f"\nEmotion distribution after normalization:")
    for emo, count in sorted(emotion_counts.items()):
        print(f"   {emo:<12} -> {count} conversations")

    print(f"\nTotal chunks built: {len(docs)}")

    # -- 5. Upload to ChromaDB in batches --
    print(f"Uploading to ChromaDB (batch={BATCH_SIZE})...")
    for i in range(0, len(docs), BATCH_SIZE):
        batch    = docs[i : i + BATCH_SIZE]
        vector_db.add_documents(batch)
        uploaded = min(i + BATCH_SIZE, len(docs))
        print(f"   {uploaded}/{len(docs)} chunks...")

    print(f"\nChromaDB rebuilt: {len(docs)} chunks from ESConv training set")
    print(f"   Collection : {COLLECTION_NAME}")
    print(f"   Location   : {DB_PATH}")


if __name__ == "__main__":
    build_rag()
