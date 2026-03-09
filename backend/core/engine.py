import sys
import os
import asyncio
from dotenv import load_dotenv

# Trỏ đường dẫn gốc về thư mục backend/ (lùi 1 cấp so với thư mục core/)
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)
load_dotenv(override=True)

# IMPORTS TỪ THƯ MỤC AGENT
from agent.perception import PerceptionAgent
from agent.dialogue import DialogueAgent
from agent.inference import InferenceAgent
from agent.knowledge import KnowledgeAgent
from agent.memory import GraphMemory
from agent.voice_io import VoiceInterface
from agent.emptychair_agent import EmptyChairAgent

class AgenticEmpathySystem:
    def __init__(self):
        print("🚀 Booting SoulMate System Core...")
        self.perception = PerceptionAgent()
        self.inference = InferenceAgent()
        self.knowledge = KnowledgeAgent(reset_db=False)
        self.dialogue = DialogueAgent()
        self.voice_io = VoiceInterface()
        self.turn_counter = 0 
        
        try:
            self.memory = GraphMemory("bolt://localhost:7687", ("neo4j", "123456789"))
            if self.memory.driver: print("✅ Graph Memory Connected")
        except Exception as e:
            self.memory = None
            print(f"⚠️ Memory Disconnected: {e}")

        self.empty_chair = EmptyChairAgent(memory=self.memory)

    async def background_learning(self, user_input, user_id, emotion):
        """Task 1: Chấm điểm OCEAN và cập nhật Memory (Chạy ngầm)"""
        current_profile = {}
        if self.memory and self.memory.driver:
            current_profile = self.memory.get_user_profile(user_id)
        
        profile_str = ", ".join([f"{k}: {v}" for k, v in current_profile.items()])
        
        new_traits_input = await asyncio.to_thread(
            self.inference.infer_traits,
            user_input, emotion, "normal", profile_str
        )
        
        if self.memory and self.memory.driver:
            _, deltas = self.memory.update_user_profile(user_id, new_traits_input)
            self._print_stat_changes(deltas)

    def _print_stat_changes(self, deltas):
        if not deltas: return
        print("\n   📊 [STATS UPDATE]")
        for trait, change in deltas.items():
            icon = "📈" if change > 0 else "📉"
            sign = "+" if change > 0 else ""
            print(f"      {icon} {trait.capitalize()}: {sign}{change:.3f}")
        print("")

    async def manage_reflection(self, user_id):
        """Task 2: Suy ngẫm Narrative (Chạy ngầm mỗi 10 câu)"""
        self.turn_counter += 1
        if self.turn_counter % 10 == 0:
            print(f"\n🤔 [System] Reflecting on recent history...")
            await asyncio.to_thread(self._run_reflection_logic, user_id)

    def _run_reflection_logic(self, user_id):
        if not self.memory or not self.memory.driver: return
        history_str = self.memory.get_context(user_id, limit=20)
        try:
            old_narrative = self.memory.get_narrative_profile(user_id) 
        except: 
            old_narrative = "No narrative history."

        new_narrative = self.inference.reflect_on_history(history_str, old_narrative)
        try:
            self.memory.save_narrative_profile(user_id, new_narrative)
            print(f"✅ [Deep Reflection] Profile Updated.")
        except:
            print("⚠️ Narrative Save Failed.")

    async def process_brain(self, user_input, user_id, emotion):
        """Trung tâm xử lý luồng chat chính"""
        history_context = ""
        current_profile = {}
        narrative_profile = "No narrative yet."

        if self.memory and self.memory.driver:
            history_context = self.memory.get_context(user_id)
            current_profile = self.memory.get_user_profile(user_id)
            try:
                narrative_profile = self.memory.get_narrative_profile(user_id)
            except: pass
        
        profile_str = ", ".join([f"{k}: {v}" for k, v in current_profile.items()])
        full_long_term_profile = f"OCEAN: {profile_str} | SUMMARY: {narrative_profile}"

        rag_context = await asyncio.to_thread(self.knowledge.retrieve_examples, user_input, emotion)
        
        ai_response = await asyncio.to_thread(
            self.dialogue.generate_response,
            user_input=user_input,
            emotion=emotion,
            response_time="normal", 
            memory=history_context,
            rag_examples=rag_context,
            long_term_profile=full_long_term_profile,
            **current_profile
        )
        
        if self.memory and self.memory.driver:
            self.memory.add_turn(user_id, user_input, emotion, ai_response)

        return ai_response

    def close(self):
        """Đóng kết nối khi tắt server"""
        if self.memory: self.memory.close()