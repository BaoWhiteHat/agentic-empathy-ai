import os
import json
import shutil
from typing import List, Dict, Optional

# Import các thư viện AI
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

class KnowledgeAgent:
    """
    Knowledge Agent (RAG Module) - Trait Aware Version
    """
    
    def __init__(self, 
                 data_path: str = "data/conversation_data.json", 
                 db_path: str = "./chroma_db",
                 reset_db: bool = False):
        
        self.api_key = os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            print("⚠️ WARNING: Chưa thiết lập OPENAI_API_KEY.")
            
        self.data_path = data_path
        self.db_path = db_path
        
        self.embedding_model = OpenAIEmbeddings(
            model="text-embedding-3-small", 
            api_key=self.api_key
        )
        
        if reset_db and os.path.exists(self.db_path):
            print("♻️ Đang xóa Database cũ để nạp lại...")
            shutil.rmtree(self.db_path)

        self.vector_db = Chroma(
            collection_name="soulmate_knowledge_base",
            embedding_function=self.embedding_model,
            persist_directory=self.db_path
        )
        
        if self._is_db_empty():
            print("📚 Database đang trống. Bắt đầu nạp dữ liệu chuẩn...")
            self.load_data()
        else:
            print(f"✅ Knowledge Agent đã sẵn sàng! (Đã kết nối tới {self.db_path})")

    def _is_db_empty(self):
        try:
            return self.vector_db._collection.count() == 0
        except:
            return True

    def load_data(self):
        """Đọc file JSON và vector hóa dữ liệu vào ChromaDB"""
        if not os.path.exists(self.data_path):
            print(f"❌ LỖI: Không tìm thấy file dữ liệu tại {self.data_path}")
            return

        try:
            with open(self.data_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            docs = []
            print(f"⚙️ Đang xử lý {len(data)} mẫu hội thoại...")
            
            for item in data:
                transcript = item.get('transcript', '').strip()
                raw_emotion = item.get('normalized_emotion', item.get('emotion', 'neutral'))
                emotion = raw_emotion.strip().lower()
                response = item.get('response', '')
                
                # --- [FIX 1] Lấy thông tin Traits ---
                traits = item.get('traits', {})
                traits_str = ", ".join([f"{k}:{v}" for k,v in traits.items()]) # "Openness:0.8, Neuroticism:0.2..."

                if not response: continue

                # --- [FIX 2] Rich Context Embedding ---
                # Đưa traits vào nội dung vector để search chính xác hơn
                if not transcript:
                    page_content = f"CONTEXT: User is silent | EMOTION: {emotion} | TRAITS: {traits_str}"
                else:
                    page_content = f"CONTEXT: {transcript} | EMOTION: {emotion} | TRAITS: {traits_str}"
                
                # --- [FIX 3] Metadata đầy đủ ---
                metadata = {
                    "response": response,
                    "emotion": emotion,
                    "original_transcript": transcript,
                    "traits_str": traits_str # Lưu chuỗi traits để hiển thị lại
                }
                
                docs.append(Document(page_content=page_content, metadata=metadata))
            
            if docs:
                self.vector_db.add_documents(docs)
                print(f"✅ Đã nạp thành công {len(docs)} vector vào bộ nhớ!")
            else:
                print("⚠️ Không có dữ liệu hợp lệ để nạp.")
            
        except Exception as e:
            print(f"❌ Lỗi khi nạp dữ liệu RAG: {e}")

    def retrieve_examples(self, query_transcript: str, current_emotion: str, k: int = 3) -> str:
        """
        Tìm kiếm có lọc theo Cảm Xúc (Metadata Filtering)
        """
        try:
            query_transcript = query_transcript.strip()
            target_emotion = current_emotion.lower() if current_emotion else "neutral"

            if not query_transcript:
                search_query = "User is silent"
            else:
                # --- [FIX 4] Search Query thông minh hơn ---
                # Tìm kiếm cả ngữ cảnh cảm xúc
                search_query = f"{query_transcript} (Emotion: {target_emotion})"
            
            # Ưu tiên 1: Lọc cứng theo Emotion
            results = self.vector_db.similarity_search(
                search_query, 
                k=k,
                filter={"emotion": target_emotion} 
            )
            
            # Fallback
            if not results:
                print(f"⚠️ Không có mẫu cho '{target_emotion}'. Đang tìm kiếm chung...")
                results = self.vector_db.similarity_search(search_query, k=k)

            # --- [FIX 5] Output chi tiết hơn cho LLM ---
            formatted_examples = ""
            for i, doc in enumerate(results):
                formatted_examples += f"Example {i+1}:\n"
                formatted_examples += f"- Situation: {doc.metadata.get('original_transcript')}\n"
                formatted_examples += f"- User Emotion: {doc.metadata.get('emotion')}\n"
                formatted_examples += f"- User Traits: {doc.metadata.get('traits_str')}\n" # <--- Quan trọng
                formatted_examples += f"- Ideal Response: {doc.metadata.get('response')}\n\n"
            
            return formatted_examples.strip()

        except Exception as e:
            print(f"⚠️ Retrieval Error: {e}")
            return ""

if __name__ == "__main__":
    agent = KnowledgeAgent(reset_db=True) # Reset lại DB để nạp cấu trúc mới
    
    print("\n--- TEST RAG ---")
    test_query = "I feel useless and lonely"
    test_emotion = "sad"
    
    print(f"🔎 Query: '{test_query}' (Emotion: {test_emotion})")
    examples = agent.retrieve_examples(test_query, test_emotion)
    print("\n📝 KẾT QUẢ TÌM THẤY:")
    print(examples)