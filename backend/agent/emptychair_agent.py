# Tùy thuộc vào LLM cậu đang dùng, import thư viện tương ứng (OpenAI, Google, Mistral...)
from langchain_openai import ChatOpenAI 
from langchain_core.prompts import ChatPromptTemplate
from agent.prompts import EMPTY_CHAIR_SYSTEM_PROMPT, EMPTY_CHAIR_USER_PROMPT
from agent.memory import GraphMemory

class EmptyChairAgent:
    def __init__(self, memory: GraphMemory, llm=None):
        """
        Khởi tạo Agent Đóng vai phản diện (PsyPlay)
        """
        self.memory = memory
        # Khởi tạo LLM. Hãy đổi tên model thành model cậu đang dùng cho project.
        self.llm = llm or ChatOpenAI(temperature=0.7, model="gpt-4o-mini") 
        
        # Kết hợp System Prompt và User Prompt
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", EMPTY_CHAIR_SYSTEM_PROMPT),
            ("human", EMPTY_CHAIR_USER_PROMPT)
        ])
        
        # Tạo chuỗi LangChain (Chain)
        self.chain = self.prompt | self.llm

    # ---> THÊM 'emotion: str' VÀO ĐÂY <---
    def generate_response(self, user_id: str, target_name: str, user_input: str, emotion: str) -> str:
        # 1. Lấy lịch sử xích mích
        conflict_history = self.memory.get_conflict_history(user_id, target_name)
        
        # 2. Tiêm tham số tính cách (PsyPlay)
        traits = "extremely low in agreeableness, very high in neuroticism, and extremely low in openness"
        descriptors = "unfriendly, stubborn, uncooperative, irritable, and argumentative"
        
        # 3. Kích hoạt LangChain
        response = self.chain.invoke({
            "target_name": target_name,
            "traits": traits,
            "descriptors": descriptors,
            "conflict_history": conflict_history,
            "user_input": user_input
        })
        ai_reply = response.content

        # 4. Lưu lại hội thoại với CẢM XÚC THẬT được detect
        # ---> THAY "anger" BẰNG BIẾN emotion <---
        self.memory.add_turn(user_id, user_input, emotion, ai_reply)
        
        return ai_reply

# --- Code test nhanh nội bộ file ---
if __name__ == "__main__":
    import os
    # Đảm bảo đã set biến môi trường OPENAI_API_KEY (hoặc API của LLM cậu dùng)
    
    # Kết nối thử DB
    mem = GraphMemory("bolt://localhost:7687", ("neo4j", "123456789"))
    
    # Khởi tạo Agent
    toxic_agent = EmptyChairAgent(memory=mem)
    
    # Chạy thử
    print("🤖 Bắt đầu test xả giận...")
    reply = toxic_agent.generate_response(
        user_id="test_user_1", 
        target_name="Minh", 
        user_input="Ông Minh, tại sao cuối tuần rồi ông lại bắt tôi OT mà không báo trước? Ông làm việc kiểu gì vậy?"
    )
    print(f"\n[AI - Minh]: {reply}")