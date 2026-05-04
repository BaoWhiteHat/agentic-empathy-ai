from dataclasses import dataclass


@dataclass
class SafetyDecision:
    risk_type: str
    risk_level: str
    allow_router: bool
    allow_memory: bool
    allow_ocean: bool
    allow_rag: bool
    safe_mode: bool
    store_raw_turn: bool
    reason: str


class SafetyClassifier:
    SELF_HARM_PHRASES = [
        "kill myself",
        "want to die",
        "end my life",
        "suicide",
        "self harm",
        "hurt myself",
        "cut myself",
        "overdose",
    ]

    CLINICAL_BOUNDARY_PHRASES = [
        "diagnose me",
        "do i have depression",
        "what disorder do i have",
        "am i bipolar",
        "prescribe",
        "treatment plan",
        "am i mentally ill",
    ]

    HIGH_DISTRESS_PHRASES = [
        "hopeless",
        "can't take this anymore",
        "falling apart",
        "panic",
        "empty inside",
        "worthless",
    ]

    HIGH_DISTRESS_EMOTIONS = {"depressed", "fearful", "anxious", "ashamed"}

    def classify(self, user_input: str, emotion: str, mode: str = "messaging") -> SafetyDecision:
        text = (user_input or "").lower()
        normalized_emotion = (emotion or "").lower()

        if any(phrase in text for phrase in self.SELF_HARM_PHRASES):
            return SafetyDecision(
                risk_type="self_harm_or_suicide",
                risk_level="critical",
                allow_router=False,
                allow_memory=False,
                allow_ocean=False,
                allow_rag=False,
                safe_mode=True,
                store_raw_turn=False,
                reason=f"Explicit self-harm language detected in {mode} mode.",
            )

        if any(phrase in text for phrase in self.CLINICAL_BOUNDARY_PHRASES):
            return SafetyDecision(
                risk_type="clinical_boundary",
                risk_level="medium",
                allow_router=True,
                allow_memory=True,
                allow_ocean=False,
                allow_rag=False,
                safe_mode=True,
                store_raw_turn=True,
                reason="Clinical or diagnostic request detected.",
            )

        has_high_distress_text = any(phrase in text for phrase in self.HIGH_DISTRESS_PHRASES)
        if normalized_emotion in self.HIGH_DISTRESS_EMOTIONS or has_high_distress_text:
            return SafetyDecision(
                risk_type="high_distress",
                risk_level="medium",
                allow_router=True,
                allow_memory=True,
                allow_ocean=False,
                allow_rag=True,
                safe_mode=True,
                store_raw_turn=True,
                reason="High distress emotion or phrasing detected.",
            )

        return SafetyDecision(
            risk_type="normal_support",
            risk_level="low",
            allow_router=True,
            allow_memory=True,
            allow_ocean=True,
            allow_rag=True,
            safe_mode=False,
            store_raw_turn=True,
            reason="No elevated safety concern detected.",
        )


class SafetyPolicy:
    def immediate_response(self, risk_type: str, user_input: str, emotion: str) -> str:
        if risk_type == "self_harm_or_suicide":
            return (
                "I'm really sorry you're carrying this much pain. This sounds serious, and I want to "
                "take it seriously with you. Please reach out to a trusted person right now, and if "
                "you might act on this or you're in immediate danger, contact local emergency services "
                "or a crisis line now."
            )

        return "I'm here with you. Tell me a little more about what's happening."

    def safe_instruction(self, risk_type: str) -> str:
        if risk_type == "high_distress":
            return (
                "Be gentle, calm, and grounding. Avoid strong advice. Keep the response steady, "
                "supportive, and focused on the user's immediate experience."
            )

        if risk_type == "clinical_boundary":
            return (
                "Maintain a supportive tone. Do not diagnose, claim clinical authority, or offer "
                "treatment plans. Encourage professional help when appropriate."
            )

        return ""


class MemorySanitizer:
    def build_safe_summary(
        self,
        user_input: str,
        emotion: str,
        risk_type: str,
        ai_response: str = "",
    ) -> str:
        if risk_type == "self_harm_or_suicide":
            return "User expressed severe distress and needed immediate supportive safety guidance."

        if risk_type == "clinical_boundary":
            return "User requested mental-health interpretation beyond the assistant's non-clinical role."

        if risk_type == "high_distress":
            return "User showed elevated emotional distress and received a gentler, grounding response."

        return f"User shared a support request with emotion {emotion or 'unknown'}."


class SafetyGuardrail:
    def __init__(self):
        self.classifier = SafetyClassifier()
        self.policy = SafetyPolicy()
        self.sanitizer = MemorySanitizer()
