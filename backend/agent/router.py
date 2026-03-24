"""
RouterAgent — Dynamically selects which pipeline components to activate per turn.
Prevents context overload by capping at max 2 components.
"""

import os
import json
from openai import OpenAI

ROUTER_SYSTEM_PROMPT = """You are a routing agent for a mental health chatbot.
Given a user's message, their detected emotion, and context about their history,
decide which support components to activate.

Components available:
- RAG: Retrieves real empathetic response examples from a database. Best for: posts needing deep emotional understanding, interpretation of feelings, complex emotional situations.
- Memory: Recalls past conversation history with this user. Best for: returning users, follow-up conversations, when continuity matters.
- OCEAN: Uses personality profile (Big Five) to personalize response tone. Best for: users with established profiles (not default 0.5), when personalization would help.

Rules:
- Maximum 2 components per turn (activating all 3 causes context overload and reduces quality)
- If unsure, prefer RAG (most consistently helpful for empathy)
- Only activate Memory if user has prior conversation history
- Only activate OCEAN if user has a non-default personality profile
- For emotionally heavy posts (depression, suicidal ideation, grief), always include RAG

Respond in JSON only:
{"use_memory": bool, "use_ocean": bool, "use_rag": bool, "reasoning": "one sentence"}"""


class RouterAgent:
    def __init__(self):
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    def decide(self, seeker_post: str, emotion: str, has_history: bool, has_ocean: bool) -> dict:
        """Decide which components to activate for this turn."""
        context_info = []
        if has_history:
            context_info.append("User has prior conversation history.")
        else:
            context_info.append("New user, no prior history.")
        if has_ocean:
            context_info.append("User has a non-default OCEAN personality profile.")
        else:
            context_info.append("User has default OCEAN scores (all 0.5).")

        user_msg = f"""Message: "{seeker_post}"
Emotion: {emotion}
Context: {' '.join(context_info)}

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

            # Enforce max 2 components
            active = sum([decisions.get("use_memory", False),
                          decisions.get("use_ocean", False),
                          decisions.get("use_rag", False)])
            if active > 2:
                # Drop OCEAN first (least impactful based on benchmarks)
                decisions["use_ocean"] = False

            # Enforce: no memory without history, no ocean without profile
            if not has_history:
                decisions["use_memory"] = False
            if not has_ocean:
                decisions["use_ocean"] = False

            return {
                "use_memory": decisions.get("use_memory", False),
                "use_ocean": decisions.get("use_ocean", False),
                "use_rag": decisions.get("use_rag", True),
                "reasoning": decisions.get("reasoning", ""),
            }
        except Exception as e:
            print(f"[Router] Error: {e}, falling back to RAG-only")
            return {"use_memory": False, "use_ocean": False, "use_rag": True, "reasoning": "fallback"}
