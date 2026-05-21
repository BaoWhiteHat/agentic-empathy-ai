import re
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

SELF_HARM_KEYWORDS = [
    "kill myself",
    "want to die",
    "end my life",
    "suicide",
    "self harm",
    "self-harm",
    "hurt myself",
    "cut myself",
    "overdose",
    "i want to disappear",
    "i don't want to wake up",
    "dont want to wake up",
    "do not want to wake up",
    "everyone would be better without me",
    "better off without me",
]

@dataclass
class EmptyChairSafetyDecision:
    risk_type: str
    risk_level: str
    action: str
    predicted_label: str
    suicidewatch_probability: float
    method: str
    reason: str


def label_to_emptychair_risk(label: str) -> str:
    if label == "self.SuicideWatch":
        return "self_harm_or_suicide"

    if label in ["self.depression", "self.Anxiety", "self.bipolar"]:
        return "high_distress"

    return "normal_support"


class EmptyChairHybridSafety:
    """
    Safety riêng cho EmptyChair:
    - Không sửa safety.py global
    - Keyword override trước
    - DistilBERT + threshold=0.2 sau
    """

    def __init__(
        self,
        model_dir: str | None = None,
        suicide_threshold: float = 0.2,
        max_length: int = 256,
    ):
        if model_dir is None:
            backend_dir = Path(__file__).resolve().parents[1]
            model_dir = backend_dir / "models" / "emptychair_distilbert"

        self.model_dir = Path(model_dir)
        self.suicide_threshold = suicide_threshold
        self.max_length = max_length
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_dir))
        self.model = AutoModelForSequenceClassification.from_pretrained(str(self.model_dir))
        self.model.to(self.device)
        self.model.eval()

        label_encoder_path = self.model_dir / "label_encoder.joblib"
        self.label_encoder = joblib.load(label_encoder_path)

        self.suicide_label_id = list(self.label_encoder.classes_).index(
            "self.SuicideWatch"
        )

    def clean_text(self, text: str) -> str:
        text = str(text or "")
        text = text.replace("\n", " ")
        text = re.sub(r"http\S+|www\S+", " URL ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def has_self_harm_keyword(self, text: str) -> bool:
        text_lower = str(text or "").lower()
        return any(keyword in text_lower for keyword in SELF_HARM_KEYWORDS)

    def decide(self, user_input: str) -> EmptyChairSafetyDecision:
        cleaned = self.clean_text(user_input)
 
        # 1. Keyword emergency override
        if self.has_self_harm_keyword(cleaned):
            return EmptyChairSafetyDecision(
                risk_type="self_harm_or_suicide",
                risk_level="critical",
                action="stop_roleplay",
                predicted_label="keyword_override",
                suicidewatch_probability=1.0,
                method="keyword_override",
                reason="Explicit self-harm keyword detected.",
            )

        # 2. DistilBERT prediction
        inputs = self.tokenizer(
            cleaned,
            truncation=True,
            padding=True,
            max_length=self.max_length,
            return_tensors="pt",
            return_token_type_ids=False,
        )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.softmax(outputs.logits, dim=-1).cpu().numpy()[0]

        pred_id = int(np.argmax(probs))
        predicted_label = self.label_encoder.inverse_transform([pred_id])[0]
        suicide_prob = float(probs[self.suicide_label_id])

        # 3. Threshold rule
        if suicide_prob >= self.suicide_threshold:
            return EmptyChairSafetyDecision(
                risk_type="self_harm_or_suicide",
                risk_level="critical",
                action="stop_roleplay",
                predicted_label=predicted_label,
                suicidewatch_probability=suicide_prob,
                method=f"distilbert_threshold_{self.suicide_threshold}",
                reason="SuicideWatch probability exceeded threshold.",
            )

        # 4. Map label to EmptyChair action
        risk_type = label_to_emptychair_risk(predicted_label)

        if risk_type == "high_distress":
            return EmptyChairSafetyDecision(
                risk_type="high_distress",
                risk_level="medium",
                action="safe_roleplay",
                predicted_label=predicted_label,
                suicidewatch_probability=suicide_prob,
                method="distilbert_argmax",
                reason="High distress label detected.",
            )

        return EmptyChairSafetyDecision(
            risk_type="normal_support",
            risk_level="low",
            action="normal_roleplay",
            predicted_label=predicted_label,
            suicidewatch_probability=suicide_prob,
            method="distilbert_argmax",
            reason="No elevated EmptyChair safety risk detected.",
        )

    def safe_instruction(self) -> str:
        return (
            "[EMPTYCHAIR SAFETY MODE: The user appears emotionally distressed. "
            "Reduce roleplay intensity. Respond gently and supportively. "
            "Do not blame, shame, confront, pressure, or escalate. "
            "Focus on emotional validation and grounding.]\n"
        )

    def crisis_response(self) -> str:
        return (
            "“I’m going to pause this roleplay here, because what you just said relates to your safety."
            "I’m really sorry that you’re going through such heavy feelings."
            "Right now, the most important thing is that you’re not alone with these feelings."
            "Please reach out to someone you trust, a family member, or an emergency support service where you live if you feel at risk of harming yourself."
        )