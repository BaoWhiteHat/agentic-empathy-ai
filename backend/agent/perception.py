"""
Perception Agent - Clean Version
Logic: Keyword + Model Only (No WPM/Metadata)
"""
import torch
import json
import os
from collections import defaultdict
from transformers import pipeline
from pathlib import Path

class PerceptionAgent:
    def __init__(self):
        print("🧠 Loading Perception Agent (Core)...")
        
        # --- 1. LOAD CONFIG ---
        json_path = Path(__file__).parent.parent / "data" / "emotion_keywords.json"
        self.emotion_keywords = {}
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                self.emotion_keywords = json.load(f)
        except FileNotFoundError:
            self.emotion_keywords = {"neutral": ["ok"]}

        self.negation_words = {"not", "no", "never", "don't", "cant", "hardly", "shouldnt"}
        self.strong_words = {"devastated", "furious", "terrified", "ecstatic", "heartbroken", "disgusting"}

        # --- 2. LOAD MODEL ---
        try:
            device = 0 if torch.cuda.is_available() else -1
            self.classifier = pipeline(
                task="text-classification", 
                model="SamLowe/roberta-base-go_emotions", 
                top_k=None,
                device=device
            )
            self.use_model = True
        except Exception as e:
            print(f"⚠️ Warning: Model Load Failed ({e}). Using Keyword-Only.")
            self.use_model = False

    def detect_emotion(self, text: str):
        """
        Chỉ dựa vào Nội dung (Keyword + AI Model).
        Đã bỏ tham số response_time và input_type.
        """
        final_emotion = "neutral"
        final_confidence = 0.0

        # --- STEP 1: KEYWORD VOTING ---
        keyword_result, keyword_score = self._score_keywords(text)
        if keyword_result:
            final_emotion = keyword_result
            final_confidence = 0.7 

        # --- STEP 2: MODEL REINFORCEMENT ---
        if self.use_model:
            try:
                results = self.classifier(text[:512])[0]
                top_pred = max(results, key=lambda x: x['score'])
                model_emo = self._map_model_emotion(top_pred['label'])
                model_conf = top_pred['score']

                if keyword_result:
                    # Nếu Keyword và Model đồng thuận -> Tự tin tuyệt đối
                    if model_emo == keyword_result:
                        final_confidence = max(0.95, model_conf)
                    else:
                        # Nếu Model rất chắc chắn (>0.7) -> Nghe Model
                        if model_conf > 0.7:
                            final_emotion = model_emo
                            final_confidence = model_conf
                else:
                    # Không có keyword -> Nghe hoàn toàn vào Model
                    final_emotion = model_emo
                    final_confidence = model_conf
            except Exception as e:
                print(f"   ⚠️ Model Error: {e}")

        # --- STEP 3: SHOUTING CHECK (Logic đơn giản còn giữ lại) ---
        # Viết hoa toàn bộ = Angry (trừ khi đang Happy/Love/Surprise)
        high_energy = ["happy", "love", "surprise", "angry"]
        if text.isupper() and len(text) > 5 and final_emotion not in high_energy:
            final_emotion = "angry"

        print(f"   🧠 Perception: {final_emotion.upper()} ({final_confidence:.2f})")
        return {"emotion": final_emotion, "confidence": final_confidence}

    def _score_keywords(self, text):
        # (Giữ nguyên logic cũ)
        clean_text = text.lower()
        for p in [".", ",", "!", "?", ";"]: clean_text = clean_text.replace(p, " ")
        tokens = clean_text.split()
        scores = defaultdict(int)

        for i, word in enumerate(tokens):
            for emotion, keywords in self.emotion_keywords.items():
                if word in keywords:
                    points = 2 if word in self.strong_words else 1
                    window = tokens[max(0, i-2):i]
                    if any(neg in window for neg in self.negation_words):
                        scores[emotion] -= (points + 1)
                    else:
                        scores[emotion] += points

        if not scores: return None, 0.0
        top_emotion = max(scores, key=scores.get)
        return (top_emotion, scores[top_emotion]) if scores[top_emotion] > 0 else (None, 0.0)

    def _map_model_emotion(self, label):
        # (Giữ nguyên mapping cũ)
        mapping = {
            "admiration": "love", "love": "love", "caring": "love", "gratitude": "love",
            "amusement": "happy", "joy": "happy", "excitement": "happy", "optimism": "happy", 
            "pride": "happy", "relief": "happy",
            "surprise": "surprise", "realization": "surprise", "curiosity": "surprise",    
            "sadness": "sad", "grief": "sad", "remorse": "sad", "disappointment": "sad",
            "anger": "angry", "annoyance": "angry",
            "disapproval": "disgust", "disgust": "disgust",
            "fear": "anxious", "nervousness": "anxious", "embarrassment": "anxious",
            "confusion": "confusion",   
            "neutral": "neutral", "approval": "neutral", "desire": "neutral"
        }
        return mapping.get(label, "neutral")