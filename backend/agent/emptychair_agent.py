from langchain_openai import ChatOpenAI 
from langchain_core.prompts import ChatPromptTemplate
from agent.prompts import EMPTY_CHAIR_SYSTEM_PROMPT, EMPTY_CHAIR_USER_PROMPT
from agent.memory import GraphMemory

class EmptyChairAgent:
    def __init__(self, memory: GraphMemory, llm=None):
        self.memory = memory
        self.llm = llm or ChatOpenAI(temperature=0.7, model="gpt-4o-mini") 
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", EMPTY_CHAIR_SYSTEM_PROMPT),
            ("human", EMPTY_CHAIR_USER_PROMPT)
        ])
        
        self.chain = self.prompt | self.llm

    # ---> THÊM 2 BIẾN MỚI VÀO HÀM <---
    def generate_response(self, user_id: str, target_name: str, relationship: str, unspoken_need: str, user_input: str, emotion: str) -> str:
        # 1. Lấy lịch sử tương tác/xích mích từ bộ nhớ đồ thị
        conflict_history = self.memory.get_conflict_history(user_id, target_name)
        
        # 2. Bơm toàn bộ dữ liệu vào LangChain theo đúng chuẩn Prompt tiếng Anh
        response = self.chain.invoke({
            "target_name": target_name,
            "relationship": relationship,
            "unspoken_need": unspoken_need,
            "conflict_history": conflict_history,
            "user_emotion": emotion,       
            "user_input": user_input
        })
        ai_reply = response.content

        # 3. Lưu lại hội thoại vào Neo4j
        self.memory.add_turn(user_id, user_input, emotion, ai_reply)
        
        return ai_reply

# --- Code test nhanh nội bộ file ---
if __name__ == "__main__":
    import os
    
    mem = GraphMemory("bolt://localhost:7687", ("neo4j", "123456789"))
    healing_agent = EmptyChairAgent(memory=mem)
    
    print("✨ Bắt đầu test phiên trị liệu chữa lành...")
    reply = healing_agent.generate_response(
        user_id="test_user_1", 
        target_name="My Father", 
        relationship="A strict father who rarely showed affection, creating a distance between us.",
        unspoken_need="I just wanted him to say he was proud of me, instead of always pointing out my flaws.",
        user_input="Dad, I got the job. But I still feel like it's never enough for you.",
        emotion="Sadness"
    )
    print(f"\n[AI - My Father]: {reply}")