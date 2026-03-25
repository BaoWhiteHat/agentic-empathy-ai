# agent/dialogue.py
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Import từ file prompts.py
from .prompts import SOULMATE_SYSTEM_PROMPT, SOULMATE_USER_PROMPT

class DialogueAgent:
    def __init__(self, model_name: str = "gpt-3.5-turbo"):
        print("🧠 Loading Dialogue Agent...")
        api_key = os.environ.get("OPENAI_API_KEY")
        
        # Temperature=0.7: Sáng tạo vừa đủ, không quá bay bổng
        self.llm = ChatOpenAI(model=model_name, temperature=0, api_key=api_key)
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SOULMATE_SYSTEM_PROMPT),
            ("human", SOULMATE_USER_PROMPT),
        ])
        
        self.chain = self.prompt | self.llm | StrOutputParser()
    
    def generate_response(self, user_input: str, emotion: str, response_time: str, 
                          memory: str = "", long_term_profile: str = "No history", 
                          rag_examples: str = "", **kwargs) -> str:
        """
        Sinh câu trả lời "Metadata-Aware".
        Sử dụng **kwargs để hứng các chỉ số OCEAN (openness, neuroticism...) 
        từ việc unpacking dictionary ở main.py.
        """
        try:
            # 1. Trích xuất chỉ số OCEAN từ kwargs (Nếu không có thì mặc định 0.5)
            # Lưu ý: Key ở đây phải khớp với key trong file prompts.py ({openness}, {neuroticism}...)
            openness = kwargs.get('openness', 0.5)
            conscientiousness = kwargs.get('conscientiousness', 0.5)
            extraversion = kwargs.get('extraversion', 0.5)
            agreeableness = kwargs.get('agreeableness', 0.5)
            neuroticism = kwargs.get('neuroticism', 0.5)

            # 2. Gọi LLM
            response = self.chain.invoke({
                "user_input": user_input,
                "emotion": emotion,
                "response_time": response_time, 
                "memory": memory,
                "long_term_profile": long_term_profile,
                "rag_examples": rag_examples,
                
                # Truyền các biến đã trích xuất vào
                "openness": openness, 
                "conscientiousness": conscientiousness,
                "extraversion": extraversion,
                "agreeableness": agreeableness,
                "neuroticism": neuroticism
            })
            
            return response.strip().replace('"', '') # Xóa dấu ngoặc kép thừa nếu có
            
        except Exception as e:
            print(f"❌ Dialogue Error: {e}")
            # Fallback an toàn khi hệ thống lỗi
            return "Mình đang lắng nghe đây. Bạn kể tiếp đi..."