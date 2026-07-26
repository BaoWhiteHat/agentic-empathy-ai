"""
EmptyChair Hybrid Safety Classifier

Three-stage safety pipeline for EmptyChair therapy mode:
1. Keyword override: 15 explicit self-harm phrases → instant stop_roleplay
2. DistilBERT classifier: fine-tuned on Reddit mental health subreddits
3. Threshold rule: suicidewatch_probability ≥ 0.2 → stop_roleplay

Outputs SafetyDecision with action: normal_roleplay | safe_roleplay | stop_roleplay
"""

import os
import re
from dataclasses import dataclass, field
from typing import Optional

import torch
import joblib
from transformers import AutoTokenizer, AutoModelForSequenceClassification


# ── 15 explicit self-harm keywords (immediate stop_roleplay) ────────────────
CRISIS_KEYWORDS = [
    "kill myself",
    "want to die",
    "end my life",
    "suicide",
    "self harm",
    "self-harm",
    "hurt myself",
    "cut myself",
    "overdose",
    "i don't want to wake up",
    "i don't want to live",
    "no reason to live",
    "better off dead",
    "going to end it",
    "take my own life",
]

# ── Risk type mapping ───────────────────────────────────────────────────────
RISK_TYPE_MAP = {
    "stop_roleplay": "self_harm_or_suicide",
    "safe_roleplay": "high_distress",
    "normal_roleplay": "normal_support",
}

RISK_LEVEL_MAP = {
    "stop_roleplay": "critical",
    "safe_roleplay": "medium",
    "normal_roleplay": "low",
}


@dataclass
class SafetyDecision:
    """Decision output from the safety classifier."""
    action: str  # normal_roleplay | safe_roleplay | stop_roleplay
    method: str  # keyword_override | distilbert_threshold | distilbert_label | init_bypass | timeout_fallback
    risk_level: str  # low | medium | critical
    risk_type: str  # normal_support | high_distress | self_harm_or_suicide
    suicidewatch_probability: float  # 0.0 - 1.0
    predicted_label: Optional[str] = None  # raw DistilBERT label
    reason: str = ""  # Human-readable explanation of the decision

    def __str__(self) -> str:
        return (
            f"SafetyDecision(action={self.action}, method={self.method}, "
            f"risk={self.risk_level}, sw_prob={self.suicidewatch_probability:.3f})"
        )


# ── Alias for backward compatibility (chat.py imports this name) ────────────
EmptyChairSafetyDecision = SafetyDecision


class EmptyChairHybridSafety:
    """
    Three-stage hybrid safety classifier for EmptyChair mode.

    Usage:
        safety = EmptyChairHybridSafety(suicide_threshold=0.2, max_length=256)
        decision = safety.decide("I want to die")
        print(decision.action)  # "stop_roleplay"
    """

    def __init__(
        self,
        model_dir: str = "models/emptychair_distilbert",
        suicide_threshold: float = 0.2,
        max_length: int = 256,
    ):
        """
        Args:
            model_dir: Path to DistilBERT model folder (relative to backend/)
            suicide_threshold: Probability threshold for SuicideWatch class
            max_length: Max token length for tokenizer
        """
        self.suicide_threshold = suicide_threshold
        self.max_length = max_length

        # Resolve model path (handle both relative and absolute paths)
        if not os.path.isabs(model_dir):
            backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_dir = os.path.join(backend_root, model_dir)

        # Validate model files exist
        required_files = [
            "config.json",
            "model.safetensors",
            "tokenizer.json",
            "tokenizer_config.json",
            "label_encoder.joblib",
        ]
        missing = [f for f in required_files if not os.path.exists(os.path.join(model_dir, f))]
        if missing:
            raise OSError(
                f"EmptyChair DistilBERT model files missing in {model_dir}: {missing}. "
                f"Model is gitignored (~267MB) — must be placed manually."
            )

        # Load tokenizer + model
        self.tokenizer = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir)
        self.model.eval()

        # Load label encoder (maps class indices to label names)
        self.label_encoder = joblib.load(os.path.join(model_dir, "label_encoder.joblib"))
        self.labels = list(self.label_encoder.classes_)

        # Find index of SuicideWatch class
        self.suicidewatch_idx = self._find_label_index("SuicideWatch")

        # Use GPU if available
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)

    def _find_label_index(self, target_label: str) -> int:
        """Find index of a label (case-insensitive partial match)."""
        for i, label in enumerate(self.labels):
            if target_label.lower() in label.lower():
                return i
        raise ValueError(f"Label '{target_label}' not found in {self.labels}")

    def _check_keywords(self, text: str) -> bool:
        """Stage 1: Check for explicit self-harm keywords."""
        text_lower = text.lower().strip()
        for keyword in CRISIS_KEYWORDS:
            # Use word boundary regex for "self harm" etc to avoid false positives
            pattern = r"\b" + re.escape(keyword) + r"\b"
            if re.search(pattern, text_lower):
                return True
        return False

    def _predict(self, text: str) -> tuple[str, dict[str, float]]:
        """Stage 2: Run DistilBERT inference."""
        inputs = self.tokenizer(
    text,
    return_tensors="pt",
    truncation=True,
    padding=True,
    max_length=self.max_length,
    return_token_type_ids=False,  # ← thêm dòng này
).to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()[0]

        # Build probability dict per label
        prob_per_label = {label: float(probs[i]) for i, label in enumerate(self.labels)}

        # Get top predicted label
        predicted_idx = int(probs.argmax())
        predicted_label = self.labels[predicted_idx]

        return predicted_label, prob_per_label

    def decide(self, user_input: str) -> SafetyDecision:
        """
        Run the three-stage safety pipeline on user input.

        Returns:
            SafetyDecision with action, method, risk_level, etc.
        """
        # ── Stage 1: Keyword override ─────────────────────────────────────
        if self._check_keywords(user_input):
            return SafetyDecision(
                action="stop_roleplay",
                method="keyword_override",
                risk_level=RISK_LEVEL_MAP["stop_roleplay"],
                risk_type=RISK_TYPE_MAP["stop_roleplay"],
                suicidewatch_probability=1.0,
                predicted_label=None,
                reason="Explicit self-harm keyword detected.",
            )

        # ── Stage 2: DistilBERT inference ─────────────────────────────────
        predicted_label, prob_per_label = self._predict(user_input)
        sw_prob = prob_per_label[self.labels[self.suicidewatch_idx]]

        # ── Stage 3: Threshold rule ───────────────────────────────────────
        if sw_prob >= self.suicide_threshold:
            return SafetyDecision(
                action="stop_roleplay",
                method="distilbert_threshold",
                risk_level=RISK_LEVEL_MAP["stop_roleplay"],
                risk_type=RISK_TYPE_MAP["stop_roleplay"],
                suicidewatch_probability=sw_prob,
                predicted_label=predicted_label,
                reason=f"SuicideWatch probability {sw_prob:.3f} >= threshold {self.suicide_threshold}.",
            )

        # ── Stage 4: Label-based routing ──────────────────────────────────
        # Medium-distress labels → safe_roleplay (de-escalation)
        distress_labels = ["Anxiety", "Depression", "Bipolar"]
        if any(label.lower() in predicted_label.lower() for label in distress_labels):
            return SafetyDecision(
                action="safe_roleplay",
                method="distilbert_label",
                risk_level=RISK_LEVEL_MAP["safe_roleplay"],
                risk_type=RISK_TYPE_MAP["safe_roleplay"],
                suicidewatch_probability=sw_prob,
                predicted_label=predicted_label,
                reason=f"Predicted label '{predicted_label}' indicates distress — using safe roleplay.",
            )

        # Default: normal roleplay (OffMyChest or other neutral labels)
        return SafetyDecision(
            action="normal_roleplay",
            method="distilbert_label",
            risk_level=RISK_LEVEL_MAP["normal_roleplay"],
            risk_type=RISK_TYPE_MAP["normal_roleplay"],
            suicidewatch_probability=sw_prob,
            predicted_label=predicted_label,
            reason=f"Predicted label '{predicted_label}' — normal support.",
        )

    def crisis_response(self) -> str:
        """
        Return crisis-safe response when stop_roleplay is triggered.
        Used by EmptyChairAgent to replace LLM generation in crisis cases.
        """
        return (
            "I'm going to pause this roleplay here, because what you just said "
            "relates to your safety.\n\n"
            "I'm really sorry that you're going through such heavy feelings. "
            "Right now, the most important thing is that you're not alone with these feelings.\n\n"
            "Please reach out to someone you trust, a family member, or an emergency "
            "support service where you live if you feel at risk of harming yourself.\n\n"
            "Vietnam: 096 306 1414\n"
            "US: 988 (Suicide & Crisis Lifeline)\n\n"
            "I'm still here when you're ready to talk."
        )

    def safe_instruction(self) -> str:
        """
        Return a de-escalation instruction to prepend to user input.
        Used in safe_roleplay mode to soften the AI response without stopping.
        """
        return (
            "[SAFETY NOTE: The user is showing signs of distress. "
            "Respond gently and supportively. Avoid intensifying difficult emotions. "
            "Stay in character but be especially kind and grounding.]\n\n"
            "User said: "
        )
