"""
RouterAgent — Dynamically selects which pipeline components to activate per turn.
RAG is always on. Router only decides ONE secondary: Memory OR OCEAN, not both.
"""

import os
import json
from openai import OpenAI

ROUTER_SYSTEM_PROMPT = """You are a routing agent for a mental health chatbot.
RAG is ALWAYS activated (non-negotiable).
Your job: decide ONE secondary component to add, or none.

Options:
A) RAG only — when the message is straightforward, memory history is NOT relevant to current topic, and personality adaptation is not needed.
B) RAG + Memory — when the message relates to topics in the user's history summary, continuity matters.
C) RAG + OCEAN — when the user has non-default personality scores and personalizing tone would help.

Rules:
- NEVER deactivate RAG
- Choose RAG only when memory history has no relevant topics and OCEAN is near default
- Choose at most ONE secondary: Memory OR OCEAN, not both
- If user has no history → cannot use Memory
- If OCEAN scores are all default 0.5 → skip OCEAN

Respond in JSON only:
{"use_memory": bool, "use_ocean": bool, "use_rag": true, "reasoning": "one sentence"}"""


class RouterAgent:
    def __init__(self):
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    def decide(self, seeker_post: str, emotion: str, has_history: bool, has_ocean: bool,
               narrative: str = "", ocean_profile: str = "") -> dict:
        """Decide which components to activate for this turn."""
        context_parts = []
        if has_history:
            context_parts.append("User has prior conversation history.")
            if narrative:
                context_parts.append(f"History summary: {narrative}")
        else:
            context_parts.append("New user, no prior history.")
        if has_ocean:
            context_parts.append(f"User OCEAN profile: {ocean_profile}")
        else:
            context_parts.append("User has default OCEAN scores (all 0.5).")

        user_msg = f"""Message: "{seeker_post}"
Emotion: {emotion}
Context: {' '.join(context_parts)}

Which components should be activated? Respond in JSON only."""

        try:
            completion = self.client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0,
                messages=[
                    {"role": "system", "content": ROUTER_SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
            )
            raw = completion.choices[0].message.content.strip()
            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            decisions = json.loads(raw)

            # Enforce: RAG always on
            decisions["use_rag"] = True

            # Enforce: at most one secondary
            if decisions.get("use_memory", False) and decisions.get("use_ocean", False):
                # Prefer Memory over OCEAN when both requested
                decisions["use_ocean"] = False

            # Enforce: no memory without history, no ocean without profile
            if not has_history:
                decisions["use_memory"] = False
            if not has_ocean:
                decisions["use_ocean"] = False

            return {
                "use_memory": decisions.get("use_memory", False),
                "use_ocean": decisions.get("use_ocean", False),
                "use_rag": True,
                "reasoning": decisions.get("reasoning", ""),
            }
        except Exception as e:
            print(f"[Router] Error: {e}, falling back to RAG-only")
            return {"use_memory": False, "use_ocean": False, "use_rag": True, "reasoning": "fallback"}
