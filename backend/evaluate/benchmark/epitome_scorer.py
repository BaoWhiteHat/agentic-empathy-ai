"""
EPITOME Empathy Scorer

Reimplements the bi-encoder model from:
    github.com/behavioral-data/Empathy-Mental-Health

Architecture (verified from .pth weight keys):
    - seeker_encoder: RoBERTa-base
    - responder_encoder: RoBERTa-base
    - Multi-head attention (heads=1, dim=768)
    - LayerNorm (learnable alpha + bias)
    - empathy_classifier: Dense(768→768) + ReLU + Linear(768→3)
    - rationale_classifier: Linear(768→2) (unused for scoring)
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import RobertaModel, RobertaTokenizer


# ============================================================
# Model components
# ============================================================

class Norm(nn.Module):
    """LayerNorm with learnable alpha + bias (matches repo's Norm class)."""
    def __init__(self, d_model, eps=1e-6):
        super().__init__()
        self.alpha = nn.Parameter(torch.ones(d_model))
        self.bias = nn.Parameter(torch.zeros(d_model))
        self.eps = eps

    def forward(self, x):
        return self.alpha * (x - x.mean(dim=-1, keepdim=True)) / \
               (x.std(dim=-1, keepdim=True) + self.eps) + self.bias


class MultiHeadAttention(nn.Module):
    def __init__(self, heads, d_model, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        self.d_k = d_model // heads
        self.h = heads
        self.q_linear = nn.Linear(d_model, d_model)
        self.v_linear = nn.Linear(d_model, d_model)
        self.k_linear = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)
        self.out = nn.Linear(d_model, d_model)

    def forward(self, q, k, v, mask=None):
        bs = q.size(0)
        k = self.k_linear(k).view(bs, -1, self.h, self.d_k).transpose(1, 2)
        q = self.q_linear(q).view(bs, -1, self.h, self.d_k).transpose(1, 2)
        v = self.v_linear(v).view(bs, -1, self.h, self.d_k).transpose(1, 2)

        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_k)
        if mask is not None:
            scores = scores.masked_fill(mask.unsqueeze(1) == 0, -1e9)
        scores = F.softmax(scores, dim=-1)
        scores = self.dropout(scores)
        output = torch.matmul(scores, v)

        concat = output.transpose(1, 2).contiguous().view(bs, -1, self.d_model)
        return self.out(concat)


class RobertaClassificationHead(nn.Module):
    def __init__(self, hidden_size=768, num_labels=3, dropout=0.1):
        super().__init__()
        self.dense = nn.Linear(hidden_size, hidden_size)
        self.dropout = nn.Dropout(dropout)
        self.out_proj = nn.Linear(hidden_size, num_labels)

    def forward(self, x):
        x = self.dropout(x)
        x = self.dense(x)
        x = torch.relu(x)
        x = self.dropout(x)
        return self.out_proj(x)


class EncoderWrapper(nn.Module):
    """
    Wraps RobertaModel with a .roberta attribute to match the old repo's state_dict keys.
    Old keys: seeker_encoder.roberta.embeddings... → this wrapper provides that .roberta prefix.
    """
    def __init__(self):
        super().__init__()
        self.roberta = RobertaModel.from_pretrained("roberta-base")


class BiEncoderAttentionWithRationaleClassification(nn.Module):
    """
    Bi-encoder empathy classifier.
    Matches state_dict keys: seeker_encoder.roberta.*, responder_encoder.roberta.*, attn.*, norm.*, empathy_classifier.*, rationale_classifier.*
    """
    def __init__(self, hidden_size=768, attn_heads=1, dropout=0.2):
        super().__init__()

        self.seeker_encoder = EncoderWrapper()
        self.responder_encoder = EncoderWrapper()

        self.attn = MultiHeadAttention(attn_heads, hidden_size, dropout)
        self.norm = Norm(hidden_size)
        self.dropout = nn.Dropout(dropout)

        self.empathy_classifier = RobertaClassificationHead(hidden_size, num_labels=3)
        self.rationale_classifier = nn.Linear(hidden_size, 2)

    def forward(self, input_ids_SP, attention_mask_SP, input_ids_RP, attention_mask_RP):
        outputs_SP = self.seeker_encoder.roberta(input_ids_SP, attention_mask=attention_mask_SP)
        outputs_RP = self.responder_encoder.roberta(input_ids_RP, attention_mask=attention_mask_RP)

        seq_SP = outputs_SP.last_hidden_state  # (batch, seq_len, 768)
        seq_RP = outputs_RP.last_hidden_state

        # Cross-attention: responder attends to seeker
        seq_RP = seq_RP + self.dropout(self.attn(seq_RP, seq_SP, seq_SP))

        # Empathy classification from [CLS] token of responder
        logits = self.empathy_classifier(seq_RP[:, 0, :])
        return logits


# ============================================================
# Scorer wrapper
# ============================================================

class EpitomeScorer:
    """Loads 3 EPITOME models (ER, IP, EX) and scores (seeker, response) pairs."""

    def __init__(self, er_path: str, ip_path: str, ex_path: str):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = RobertaTokenizer.from_pretrained("roberta-base")

        print(f"  Loading EPITOME models on {self.device}...")
        self.models = {}
        for name, path in [("ER", er_path), ("IP", ip_path), ("EX", ex_path)]:
            model = BiEncoderAttentionWithRationaleClassification()
            state_dict = torch.load(path, map_location=self.device, weights_only=False)

            # Handle potential key mismatches between transformers versions
            # Old repo uses .roberta. prefix inside encoder; new transformers may differ
            load_result = model.load_state_dict(state_dict, strict=False)
            if load_result.missing_keys:
                print(f"    WARNING [{name}]: {len(load_result.missing_keys)} missing keys")
                # Print first few for debugging
                for k in load_result.missing_keys[:5]:
                    print(f"      missing: {k}")
            if load_result.unexpected_keys:
                print(f"    WARNING [{name}]: {len(load_result.unexpected_keys)} unexpected keys")
                for k in load_result.unexpected_keys[:5]:
                    print(f"      unexpected: {k}")

            model.to(self.device)
            model.eval()
            self.models[name] = model
            print(f"    {name} model loaded.")

    def _tokenize(self, text: str):
        return self.tokenizer(
            text,
            max_length=64,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

    @torch.no_grad()
    def score(self, seeker_post: str, response_post: str) -> dict:
        """Score a single (seeker, response) pair. Returns dict with ER, IP, EX labels (0/1/2)."""
        enc_sp = self._tokenize(seeker_post)
        enc_rp = self._tokenize(response_post)

        input_ids_SP = enc_sp["input_ids"].to(self.device)
        attention_mask_SP = enc_sp["attention_mask"].to(self.device)
        input_ids_RP = enc_rp["input_ids"].to(self.device)
        attention_mask_RP = enc_rp["attention_mask"].to(self.device)

        results = {}
        for name, model in self.models.items():
            logits = model(input_ids_SP, attention_mask_SP, input_ids_RP, attention_mask_RP)
            pred = torch.argmax(logits, dim=-1).item()
            results[name] = pred

        return results
