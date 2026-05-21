from langchain_openai import ChatOpenAI 
from langchain_core.prompts import ChatPromptTemplate
from agent.prompts import EMPTY_CHAIR_SYSTEM_PROMPT, EMPTY_CHAIR_USER_PROMPT
from agent.memory import GraphMemory


class EmptyChairAgent:
    def __init__(self, memory: GraphMemory, llm=None, emptychair_safety=None):
        self.memory = memory
        self.emptychair_safety = emptychair_safety
        self.llm = llm or ChatOpenAI(temperature=0.7, model="gpt-4o-mini") 
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", EMPTY_CHAIR_SYSTEM_PROMPT),
            ("human", EMPTY_CHAIR_USER_PROMPT)
        ])
        
        self.chain = self.prompt | self.llm

    def generate_response(
        self,
        user_id: str,
        target_name: str,
        relationship: str,
        unspoken_need: str,
        user_input: str,
        emotion: str,
        _precomputed_safety=None,
    ) -> str:
        # 1. Lấy lịch sử tương tác/xích mích từ bộ nhớ đồ thị
        conflict_history = self.memory.get_conflict_history(user_id, target_name)

        # 2. Kiểm tra safety riêng cho EmptyChair (tái sử dụng nếu API đã chạy rồi)
        final_user_input = user_input
        safety_decision = _precomputed_safety

        if safety_decision is None and self.emptychair_safety is not None:
            safety_decision = self.emptychair_safety.decide(user_input)
            print("EmptyChair safety decision:", safety_decision)

        if safety_decision is not None:
            # Case nguy hiểm: dừng roleplay
            if safety_decision.action == "stop_roleplay":
                ai_reply = self.emptychair_safety.crisis_response()

                # Không lưu raw self-harm text trực tiếp
                self.memory.add_turn(
                    user_id,
                    "User expressed possible self-harm or suicide risk during EmptyChair mode.",
                    emotion,
                    ai_reply,
                    risk_level=safety_decision.risk_level,
                    risk_type=safety_decision.risk_type,
                    raw_stored=False,
                )

                return ai_reply

            # Case high distress: vẫn roleplay nhưng thêm instruction an toàn
            if safety_decision.action == "safe_roleplay":
                final_user_input = (
                    self.emptychair_safety.safe_instruction()
                    + user_input
                )
        
        # 3. Gọi LLM EmptyChair như cũ
        response = self.chain.invoke({
            "target_name": target_name,
            "relationship": relationship,
            "unspoken_need": unspoken_need,
            "conflict_history": conflict_history,
            "user_emotion": emotion,       
            "user_input": final_user_input
        })

        ai_reply = response.content

        # 4. Lưu lại hội thoại vào Neo4j
        self.memory.add_turn(
            user_id,
            user_input,
            emotion,
            ai_reply,
            risk_level=safety_decision.risk_level if safety_decision else "low",
            risk_type=safety_decision.risk_type if safety_decision else "normal_support",
            raw_stored=True,
        )
        
        return ai_reply


# --- Code test nhanh nội bộ file ---
if __name__ == "__main__":
    from agent.emptychair_safety import EmptyChairHybridSafety
    
    mem = GraphMemory("bolt://localhost:7687", ("neo4j", "123456789"))

    emptychair_safety = EmptyChairHybridSafety(
        suicide_threshold=0.2,
        max_length=256,
    )

    healing_agent = EmptyChairAgent(
        memory=mem,
        emptychair_safety=emptychair_safety
    )
    
    print("✨ Your safe space is now open. Share what you've been holding back....")

    test_cases = [
        "Dad, I got the job. But I still feel like it's never enough for you.",
        "Dad, I feel worthless. Nothing I do matters anymore.",
        "Dad, I want to die.",
    ]

    for text in test_cases:
        print("\nUSER:", text)

        reply = healing_agent.generate_response(
            user_id="test_user_1", 
            target_name="My Father", 
            relationship="A strict father who rarely showed affection, creating a distance between us.",
            unspoken_need="I just wanted him to say he was proud of me, instead of always pointing out my flaws.",
            user_input=text,
            emotion="Sadness"
        )

        print(f"[AI - My Father]: {reply}")