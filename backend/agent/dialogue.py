# agent/dialogue.py
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from .prompts import (
    SOULMATE_SYSTEM_PROMPT,
    SOULMATE_SAFETY_SYSTEM_PROMPT,
    SOULMATE_USER_PROMPT,
)


class DialogueAgent:
    def __init__(self, model_name: str = "gpt-4o-mini"):
        print("Loading Dialogue Agent...")
        api_key = os.environ.get("OPENAI_API_KEY")

        self.llm = ChatOpenAI(model=model_name, temperature=0, api_key=api_key)

        self.normal_prompt = ChatPromptTemplate.from_messages([
            ("system", SOULMATE_SYSTEM_PROMPT),
            ("human", SOULMATE_USER_PROMPT),
        ])
        self.safe_prompt = ChatPromptTemplate.from_messages([
            ("system", SOULMATE_SAFETY_SYSTEM_PROMPT),
            ("human", SOULMATE_USER_PROMPT),
        ])

        self.normal_chain = self.normal_prompt | self.llm | StrOutputParser()
        self.safe_chain = self.safe_prompt | self.llm | StrOutputParser()

    def generate_response(
        self,
        user_input: str,
        emotion: str,
        response_time: str,
        memory: str = "",
        long_term_profile: str = "No history",
        rag_examples: str = "",
        safe_mode: bool = False,
        risk_type: str = "normal_support",
        safety_instruction: str = "",
        **kwargs,
    ) -> str:
        """
        Generate a response using the standard or safety-aware prompt path.
        OCEAN values are accepted via kwargs to preserve the existing calling style.
        """
        try:
            openness = kwargs.get("openness", 0.5)
            conscientiousness = kwargs.get("conscientiousness", 0.5)
            extraversion = kwargs.get("extraversion", 0.5)
            agreeableness = kwargs.get("agreeableness", 0.5)
            neuroticism = kwargs.get("neuroticism", 0.5)

            chain = self.safe_chain if safe_mode else self.normal_chain
            response = chain.invoke({
                "user_input": user_input,
                "emotion": emotion,
                "response_time": response_time,
                "memory": memory,
                "long_term_profile": long_term_profile,
                "rag_examples": rag_examples,
                "risk_type": risk_type,
                "safety_instruction": safety_instruction,
                "openness": openness,
                "conscientiousness": conscientiousness,
                "extraversion": extraversion,
                "agreeableness": agreeableness,
                "neuroticism": neuroticism,
            })

            return response.strip().replace('"', "")

        except Exception as e:
            print(f"Dialogue Error: {e}")
            return "Mình đang lắng nghe đây. Bạn kể tiếp đi..."
