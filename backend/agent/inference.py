"""
Inference Agent - The Psychologist (Dual Mode)
Mode 1: Instant Analysis (OCEAN Scores)
Mode 2: Deep Reflection (Narrative Profile)
"""
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from pydantic import BaseModel, Field

# Import prompt cũ (OCEAN) từ file prompts.py
from .prompts import INFERENCE_SYSTEM_PROMPT, INFERENCE_USER_PROMPT

# --- REFLECTION PROMPT (ENGLISH VERSION) ---
REFLECTION_SYSTEM_PROMPT = """
You are an expert Behavioral Psychologist and AI Profiler.
Your task is to analyze the user's recent interactions and **UPDATE** their long-term "Narrative Profile".

[INPUT DATA]
- Recent Chat History (Last 20 turns):
{history}

- Existing Profile (Previous Analysis):
{current_profile}

[INSTRUCTIONS]
Synthesize the new interactions with the existing profile to generate an evolved understanding of the user.
Write a **single, concise paragraph** (3-5 sentences) that captures the essence of the user. 
Focus strictly on:
1. **Core Values & Beliefs**: What drives them? (e.g., Family, Career, Honesty, Freedom).
2. **Emotional Triggers**: What consistently makes them happy, anxious, angry, or nostalgic?
3. **Communication Style**: Are they direct, guarded, intellectual, emotional, or humorous?
4. **Hidden Traits**: Any contradictions between what they say and how they behave?

[OUTPUT FORMAT]
- Write as a clinical but empathetic observation note.
- Use third-person perspective (e.g., "The user is...").
- Do NOT use bullet points. Just a narrative paragraph.
"""

# --- Định nghĩa Output cho OCEAN ---
class PersonalityProfile(BaseModel):
    openness: float = Field(description="0.0-1.0 (Openness to Experience)")
    conscientiousness: float = Field(description="0.0-1.0 (Conscientiousness/Orderliness)")
    extraversion: float = Field(description="0.0-1.0 (Extraversion/Energy)")
    agreeableness: float = Field(description="0.0-1.0 (Agreeableness/Kindness)")
    neuroticism: float = Field(description="0.0-1.0 (Neuroticism/Emotional Stability)")

class InferenceAgent:
    def __init__(self, model_name: str = "gpt-4o-mini"):
        print(f"🧩 Loading Inference Agent (Dual Mode)...")
        api_key = os.environ.get("OPENAI_API_KEY")
        
        # 1. Khởi tạo LLM
        # Mode Nhanh (OCEAN): Cần chính xác logic -> Temp thấp (0.1)
        self.llm_fast = ChatOpenAI(model=model_name, temperature=0.1, api_key=api_key)
        
        # Mode Sâu (Narrative): Cần sáng tạo, tổng hợp -> Temp cao hơn (0.4)
        self.llm_slow = ChatOpenAI(model="gpt-4o", temperature=0.4, api_key=api_key) 

        # --- CHAIN 1: OCEAN SCORING (Nhanh) ---
        self.parser_ocean = JsonOutputParser(pydantic_object=PersonalityProfile)
        self.prompt_ocean = ChatPromptTemplate.from_messages([
            ("system", INFERENCE_SYSTEM_PROMPT),
            ("human", INFERENCE_USER_PROMPT)
        ])
        self.chain_ocean = self.prompt_ocean | self.llm_fast | self.parser_ocean

        # --- CHAIN 2: REFLECTION (Chậm) ---
        self.parser_reflect = StrOutputParser() # Đầu ra là text đoạn văn
        self.prompt_reflect = ChatPromptTemplate.from_template(REFLECTION_SYSTEM_PROMPT)
        self.chain_reflect = self.prompt_reflect | self.llm_slow | self.parser_reflect

    def infer_traits(self, text: str, emotion: str, response_time: str, past_profile: str) -> dict:
        """
        MODE 1: Chạy mỗi lượt chat để lấy chỉ số OCEAN
        """
        try:
            return self.chain_ocean.invoke({
                "text": text,
                "emotion": emotion,
                "response_time": response_time,
                "past_profile": past_profile
            })
        except Exception as e:
            print(f"⚠️ Ocean Error: {e}")
            return {
                "openness": 0.5, "conscientiousness": 0.5, 
                "extraversion": 0.5, "agreeableness": 0.5, "neuroticism": 0.5
            }

    def reflect_on_history(self, history_text: str, current_profile_text: str) -> str:
        """
        MODE 2: Chạy định kỳ (ví dụ mỗi 10 turns) để cập nhật Narrative
        """
        print("🤔 Inference Agent is reflecting on history...")
        try:
            new_narrative = self.chain_reflect.invoke({
                "history": history_text,
                "current_profile": current_profile_text
            })
            return new_narrative.strip()
        except Exception as e:
            print(f"⚠️ Reflection Error: {e}")
            return current_profile_text # Lỗi thì giữ nguyên cái cũ