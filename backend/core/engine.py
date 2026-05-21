import sys
import os
import asyncio
from dataclasses import asdict
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)
load_dotenv(override=True)

from agent.perception import PerceptionAgent
from agent.dialogue import DialogueAgent
from agent.inference import InferenceAgent
from agent.knowledge import KnowledgeAgent
from agent.memory import GraphMemory
from agent.voice_io import VoiceInterface
from agent.emptychair_agent import EmptyChairAgent
from agent.emptychair_safety import EmptyChairHybridSafety
from agent.router import RouterAgent
from agent.safety import SafetyGuardrail


class AgenticEmpathySystem:
    def __init__(self):
        print("Booting SoulMate System Core...")
        self.perception = PerceptionAgent()
        self.inference = InferenceAgent()
        self.knowledge = KnowledgeAgent(reset_db=False)
        self.dialogue = DialogueAgent()
        self.voice_io = VoiceInterface()
        self.router = RouterAgent()
        self.safety = SafetyGuardrail()

        self.user_turn_counters = {}

        try:
            neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
            neo4j_user = os.getenv("NEO4J_USER", "neo4j")
            neo4j_pass = os.getenv("NEO4J_PASSWORD")

            if not neo4j_pass:
                raise ValueError("NEO4J_PASSWORD not configured in .env!")

            self.memory = GraphMemory(neo4j_uri, (neo4j_user, neo4j_pass))
            if self.memory.driver:
                print("Graph Memory Connected")
        except Exception as e:
            self.memory = None
            print(f"Memory Disconnected: {e}")

        # ── EmptyChair Hybrid Safety (DistilBERT + threshold + keyword) ──
        try:
            self.emptychair_safety = EmptyChairHybridSafety(
                suicide_threshold=0.2,
                max_length=256,
            )
            print("EmptyChair Hybrid Safety Loaded (DistilBERT ready)")
        except Exception as e:
            self.emptychair_safety = None
            print(f"EmptyChair Hybrid Safety Failed to Load: {e}")
            print("→ EmptyChair will run without DistilBERT-based safety routing.")

        # Truyền emptychair_safety vào agent
        self.empty_chair = EmptyChairAgent(
            memory=self.memory,
            emptychair_safety=self.emptychair_safety,
        )

    async def background_learning(self, user_input, user_id, emotion):
        """Task 1: Update OCEAN personality scores (runs in background)"""
        if not self.memory or not self.memory.driver:
            return

        current_profile = self.memory.get_user_profile(user_id)
        profile_str = ", ".join([f"{k}: {v}" for k, v in current_profile.items()])

        new_traits_input = await asyncio.to_thread(
            self.inference.infer_traits,
            user_input, emotion, "normal", profile_str
        )

        _, deltas = self.memory.update_user_profile(user_id, new_traits_input)
        self._print_stat_changes(deltas)

    def _print_stat_changes(self, deltas):
        if not deltas:
            return
        print("\n   [STATS UPDATE]")
        for trait, change in deltas.items():
            direction = "UP" if change > 0 else "DOWN"
            sign = "+" if change > 0 else ""
            print(f"      {direction} {trait.capitalize()}: {sign}{change:.3f}")
        print("")

    def _append_safety_reason(self, base_reason: str, extra_reason: str) -> str:
        if base_reason:
            return f"{base_reason} | {extra_reason}"
        return extra_reason

    async def manage_reflection(self, user_id):
        """Task 2: Narrative reflection every 10 turns per user (runs in background)"""
        self.user_turn_counters[user_id] = self.user_turn_counters.get(user_id, 0) + 1

        if self.user_turn_counters[user_id] % 10 == 0:
            print(f"\n[System] Reflecting on history for {user_id}...")
            await asyncio.to_thread(self._run_reflection_logic, user_id)

    def _run_reflection_logic(self, user_id):
        if not self.memory or not self.memory.driver:
            return
        history_str = self.memory.get_context(user_id, limit=20)
        try:
            old_narrative = self.memory.get_narrative_profile(user_id)
        except Exception:
            old_narrative = "No narrative history."

        new_narrative = self.inference.reflect_on_history(history_str, old_narrative)
        try:
            self.memory.save_narrative_profile(user_id, new_narrative)
            print("[Deep Reflection] Profile Updated.")
        except Exception:
            print("Narrative Save Failed.")

    async def process_brain(
        self,
        user_input,
        user_id,
        emotion,
        use_memory: bool = True,
        use_ocean: bool = True,
        use_rag: bool = True,
        save_ai_response: bool = True,
        safe_mode: bool = False,
        risk_type: str = "normal_support",
        safety_instruction: str = "",
        safety_decision=None,
    ):
        """Main chat processing pipeline"""
        history_context = ""
        current_profile = {}
        narrative_profile = "No narrative yet."

        if safety_decision:
            use_memory = use_memory and safety_decision.allow_memory
            use_ocean = use_ocean and safety_decision.allow_ocean
            use_rag = use_rag and safety_decision.allow_rag

        if self.memory and self.memory.driver:
            if use_memory:
                history_context = self.memory.get_context(
                    user_id,
                    current_emotion=emotion,
                    current_message=user_input
                )
                try:
                    narrative_profile = self.memory.get_narrative_profile(user_id)
                except Exception:
                    pass

            if use_memory or use_ocean:
                current_profile = self.memory.get_user_profile(user_id)

        ocean_profile = current_profile if use_ocean else {}
        profile_str = ", ".join([f"{k}: {v}" for k, v in ocean_profile.items()])
        full_long_term_profile = f"OCEAN: {profile_str} | SUMMARY: {narrative_profile}"

        rag_context = ""
        if use_rag:
            rag_context = await asyncio.to_thread(self.knowledge.retrieve_examples, user_input, emotion)

        ai_response = await asyncio.to_thread(
            self.dialogue.generate_response,
            user_input=user_input,
            emotion=emotion,
            response_time="normal",
            memory=history_context,
            rag_examples=rag_context,
            long_term_profile=full_long_term_profile,
            safe_mode=safe_mode,
            risk_type=risk_type,
            safety_instruction=safety_instruction,
            **ocean_profile
        )

        if use_memory and self.memory and self.memory.driver:
            stored_input = user_input
            raw_stored = True

            if safety_decision and not safety_decision.store_raw_turn:
                stored_input = self.safety.sanitizer.build_safe_summary(
                    user_input=user_input,
                    emotion=emotion,
                    risk_type=risk_type,
                    ai_response=ai_response,
                )
                raw_stored = False

            if save_ai_response:
                self.memory.add_turn(
                    user_id,
                    stored_input,
                    emotion,
                    ai_response,
                    risk_level=safety_decision.risk_level if safety_decision else "low",
                    risk_type=risk_type,
                    raw_stored=raw_stored,
                )
            else:
                self.memory.add_turn(
                    user_id,
                    stored_input,
                    emotion,
                    "",
                    risk_level=safety_decision.risk_level if safety_decision else "low",
                    risk_type=risk_type,
                    raw_stored=raw_stored,
                )

        return ai_response

    async def process_brain_agentic(self, user_input, user_id, emotion,
                                     save_ai_response: bool = True,
                                     mode: str = "messaging"):
        """Agentic mode: RouterAgent decides which components to use."""
        safety = self.safety.classifier.classify(user_input, emotion, mode)

        if safety.risk_type == "self_harm_or_suicide":
            response = self.safety.policy.immediate_response(safety.risk_type, user_input, emotion)
            decisions = {
                "use_memory": False,
                "use_ocean": False,
                "use_rag": False,
                "reasoning": "safety override",
            }

            if self.memory and self.memory.driver:
                safe_summary = self.safety.sanitizer.build_safe_summary(
                    user_input=user_input,
                    emotion=emotion,
                    risk_type=safety.risk_type,
                    ai_response=response,
                )
                self.memory.add_turn(
                    user_id,
                    safe_summary,
                    emotion,
                    response if save_ai_response else "",
                    risk_level=safety.risk_level,
                    risk_type=safety.risk_type,
                    raw_stored=False,
                )

            return response, decisions, asdict(safety)

        has_history = False
        has_ocean = False
        narrative = ""
        ocean_profile_str = ""

        if self.memory and self.memory.driver:
            has_history = bool(self.memory.get_context(user_id))
            profile = self.memory.get_user_profile(user_id)
            has_ocean = any(v != 0.5 for v in profile.values())
            ocean_profile_str = ", ".join([f"{k}: {v}" for k, v in profile.items()])
            try:
                narrative = self.memory.get_narrative_profile(user_id)
            except Exception:
                narrative = ""

        decisions = self.router.decide(
            user_input, emotion, has_history, has_ocean,
            narrative=narrative, ocean_profile=ocean_profile_str
        )

        if safety.risk_type == "high_distress":
            decisions["use_ocean"] = False
            decisions["reasoning"] = self._append_safety_reason(
                decisions.get("reasoning", ""),
                "safety: OCEAN disabled for high distress",
            )
        elif safety.risk_type == "clinical_boundary":
            decisions["use_ocean"] = False
            decisions["use_rag"] = False
            decisions["reasoning"] = self._append_safety_reason(
                decisions.get("reasoning", ""),
                "safety: RAG and OCEAN disabled for clinical boundary",
            )

        print(f"  [Router] {decisions['reasoning']}")
        print(f"  [Router] RAG={decisions['use_rag']}, Memory={decisions['use_memory']}, OCEAN={decisions['use_ocean']}")

        response = await self.process_brain(
            user_input=user_input,
            user_id=user_id,
            emotion=emotion,
            use_memory=decisions["use_memory"],
            use_ocean=decisions["use_ocean"],
            use_rag=decisions["use_rag"],
            save_ai_response=save_ai_response,
            safe_mode=safety.safe_mode,
            risk_type=safety.risk_type,
            safety_instruction=self.safety.policy.safe_instruction(safety.risk_type),
            safety_decision=safety,
        )

        return response, decisions, asdict(safety)

    def close(self):
        print("Cleaning up system resources...")
        if self.memory:
            self.memory.close()
        if hasattr(self, 'voice_io'):
            self.voice_io.stop_all_audio()