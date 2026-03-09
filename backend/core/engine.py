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

# ... (giữ nguyên phần imports và trỏ đường dẫn gốc)

class AgenticEmpathySystem:
    def __init__(self):
        print("🚀 Booting SoulMate System Core...")
        self.perception = PerceptionAgent()
        self.inference = InferenceAgent()
        self.knowledge = KnowledgeAgent(reset_db=False)
        self.dialogue = DialogueAgent()
        self.voice_io = VoiceInterface()
        
        # SỬA: Dùng dictionary để đếm lượt chat riêng cho từng user
        self.user_turn_counters = {} 
        
        try:
            neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
            neo4j_user = os.getenv("NEO4J_USER", "neo4j")
            neo4j_pass = os.getenv("NEO4J_PASSWORD") 
            
            if not neo4j_pass:
                raise ValueError("🚨 Chưa cấu hình NEO4J_PASSWORD!")

            self.memory = GraphMemory(neo4j_uri, (neo4j_user, neo4j_pass))
            if self.memory.driver: print("✅ Graph Memory Connected")
        except Exception as e:
            self.memory = None
            print(f"⚠️ Memory Disconnected: {e}")

        self.empty_chair = EmptyChairAgent(memory=self.memory)

    async def background_learning(self, user_input, user_id, emotion):
        """Task 1: Cập nhật OCEAN (Chạy ngầm để không delay phản hồi)"""
        if not self.memory or not self.memory.driver: return

        current_profile = self.memory.get_user_profile(user_id)
        profile_str = ", ".join([f"{k}: {v}" for k, v in current_profile.items()])
        
        # Infer traits dựa trên đầu vào và hồ sơ hiện tại
        new_traits_input = await asyncio.to_thread(
            self.inference.infer_traits,
            user_input, emotion, "normal", profile_str
        )
        
        _, deltas = self.memory.update_user_profile(user_id, new_traits_input)
        self._print_stat_changes(deltas)

    async def manage_reflection(self, user_id):
        """Task 2: Suy ngẫm Narrative mỗi 10 câu của RIÊNG user đó"""
        # Tăng bộ đếm riêng cho user
        self.user_turn_counters[user_id] = self.user_turn_counters.get(user_id, 0) + 1
        
        if self.user_turn_counters[user_id] % 10 == 0:
            print(f"\n🤔 [System] Reflecting on history for {user_id}...")
            await asyncio.to_thread(self._run_reflection_logic, user_id)

    async def process_brain(self, user_input, user_id, emotion):
        """Trung tâm xử lý luồng chat chính (SoulMate mode)"""
        history_context = ""
        current_profile = {}
        narrative_profile = "Chưa có tiểu sử tóm tắt."

        # 1. Truy xuất dữ liệu từ Graph Memory (Neo4j)
        if self.memory and self.memory.driver:
            history_context = self.memory.get_context(user_id)
            current_profile = self.memory.get_user_profile(user_id)
            try:
                narrative_profile = self.memory.get_narrative_profile(user_id)
            except: pass
        
        profile_str = ", ".join([f"{k}: {v}" for k, v in current_profile.items()])
        full_long_term_profile = f"OCEAN: {profile_str} | SUMMARY: {narrative_profile}"

        # 2. RAG: Lấy ví dụ thấu cảm từ Knowledge Base
        rag_context = await asyncio.to_thread(self.knowledge.retrieve_examples, user_input, emotion)
        
        # 3. Dialogue Generation (Phản hồi thấu cảm)
        ai_response = await asyncio.to_thread(
            self.dialogue.generate_response,
            user_input=user_input,
            emotion=emotion,
            response_time="normal", 
            memory=history_context,
            rag_examples=rag_context,
            long_term_profile=full_long_term_profile,
            **current_profile # Truyền các chỉ số OCEAN trực tiếp vào Prompt
        )
        
        # 4. Lưu lại lượt hội thoại mới vào Graph
        if self.memory and self.memory.driver:
            self.memory.add_turn(user_id, user_input, emotion, ai_response)

        return ai_response

    # ... (giữ nguyên _print_stat_changes, _run_reflection_logic và close)
    def __init__(self):
        print("🚀 Booting SoulMate System Core...")
        self.perception = PerceptionAgent()
        self.inference = InferenceAgent()
        self.knowledge = KnowledgeAgent(reset_db=False)
        self.dialogue = DialogueAgent()
        self.voice_io = VoiceInterface()
        self.turn_counter = 0 
        
        try:
            # URI và User thường là mặc định của Neo4j (local) nên có thể để lộ không sao
            neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
            neo4j_user = os.getenv("NEO4J_USER", "neo4j")
            
            # QUAN TRỌNG: Ép buộc lấy từ .env, KHÔNG ghi mật khẩu thật ở đây!
            neo4j_pass = os.getenv("NEO4J_PASSWORD") 
            
            if not neo4j_pass:
                raise ValueError("🚨 Báo động: Chưa cấu hình NEO4J_PASSWORD trong file .env!")

            self.memory = GraphMemory(neo4j_uri, (neo4j_user, neo4j_pass))
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
        """Đóng kết nối khi tắt server hoặc reload"""
        print("🧼 Đang dọn dẹp tài nguyên hệ thống...")
        if self.memory: 
            self.memory.close()
        if hasattr(self, 'voice_io'):
            self.voice_io.stop_all_audio() # Dừng Pygame Mixer ở đây