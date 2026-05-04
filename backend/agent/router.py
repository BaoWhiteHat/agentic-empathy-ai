"""
RouterAgent - Dynamically selects which pipeline components to activate per turn.
RAG is always on. Router only decides ONE secondary: Memory OR OCEAN, not both.
"""

import json
import os
import re

from openai import OpenAI


ROUTER_SYSTEM_PROMPT = """You are a routing agent for a mental health chatbot.
RAG is ALWAYS activated (non-negotiable).
Your job: decide ONE secondary component to add, or none.

Options:
A) RAG only - choose this only when the message is self-contained, no prior history is needed for specificity, and personality adaptation is not meaningfully useful.
B) RAG + Memory - choose this when continuity or referent resolution is needed from prior conversation history.
C) RAG + OCEAN - choose this when the message is self-contained but the response should adapt tone, pacing, or framing to a clearly non-default personality profile.

Rules:
- NEVER deactivate RAG
- Choose at most ONE secondary: Memory OR OCEAN, not both
- If user has no history, cannot use Memory
- If OCEAN scores are all default 0.5, skip OCEAN
- Do not default to RAG only just because the current message is short
- If a short message is ambiguous without history, prefer Memory
- If the user profile is clearly non-default and the request is about style, coping fit, energy, routine, confidence, criticism, recovery, habit-building, or what suits the user, prefer OCEAN
- Only choose RAG only when BOTH are false:
  1. no continuity/history dependence
  2. no meaningful personality adaptation benefit
- A self-contained autobiographical narrative is still self-contained even if it uses first-person pronouns, mentions multiple past events, or describes an emotional timeline
- Pronouns that are already resolved inside the current message do NOT justify Memory
- Emotional intensity alone does NOT justify Memory
- For self-contained single-turn distress posts, RAG only is the correct default unless a clearly non-default profile would materially improve framing
- A concrete single-turn incident that already states the event, the relevant person or thing, the user's feeling, and the consequence should default to RAG only
- Do NOT choose Memory for a fully specified incident just because it mentions multiple past-tense actions, first-person pronouns, or emotional fallout
- Use Memory only when the current turn cannot be specifically understood or answered without prior conversation history
- For acute concrete incidents, do NOT choose OCEAN unless the user explicitly asks for personality-fit advice, coping-fit, routine-fit, style-fit, or framing tailored to how they operate

Select RAG + Memory when:
- the current message contains pronouns or underspecified references whose meaning truly depends on prior context
- examples include: it, she, he, they, that, this, the email, the notification, the result, the call
- the emotional meaning depends on a previously mentioned event, boundary, promise, application, deadline, relationship issue, or update
- continuity or referent resolution is needed to respond specifically and correctly
- the message would be vague or ambiguous without prior conversation history
- do NOT choose Memory for a post that fully explains the event, relationship, or problem inside the current message

Select RAG + OCEAN when:
- the message is self-contained and does NOT require prior factual context
- the best response should adapt tone, pacing, or framing to a clearly non-default stable profile
- especially for broad coaching, self-regulation, self-care, social energy, routines, confidence, criticism, recovery, habit-building, or personality-fit requests
- do NOT choose OCEAN for a concrete one-turn incident that is already fully specified unless the user explicitly asks for personalization or what would fit them
- if profile values are meaningfully non-default, do not casually dismiss OCEAN as unnecessary

Select RAG only when:
- the message is self-contained
- no prior history is needed for specificity
- and the profile is default or not meaningfully useful to the response

Examples:
1. Self-contained distress post -> RAG only
Message: "I bombed my exam today and I feel like a failure."
Choice: RAG only
Why: The problem and emotional context are fully explained in the message.

2. True referent ambiguity requiring prior context -> RAG + Memory
Message: "She finally replied and now I feel even worse about it."
Choice: RAG + Memory
Why: "She" and "it" are unresolved without prior conversation history.

3. Self-contained personality-fit request with meaningful profile -> RAG + OCEAN
Message: "I know I shut down when plans get too big. Can you suggest a coping plan that fits how I tend to operate?"
Choice: RAG + OCEAN
Why: The turn is self-contained, but a clearly non-default profile can improve pacing and framing.

4. Autobiographical post with pronouns but fully understandable in the current message -> RAG only
Message: "My boyfriend broke up with me last month and I still replay what he said every night."
Choice: RAG only
Why: The relationship, referent, and problem are already explained in the current message.

Respond in JSON only:
{"use_memory": bool, "use_ocean": bool, "use_rag": true, "reasoning": "one sentence"}"""


_OCEAN_VALUE_RE = re.compile(
    r"(openness|conscientiousness|extraversion|agreeableness|neuroticism)\s*:\s*(-?\d+(?:\.\d+)?)",
    flags=re.IGNORECASE,
)

_EVENT_MARKER_RE = re.compile(
    r"\b(today|tonight|this morning|this afternoon|this evening|earlier|when|after|while|halfway through|"
    r"realized|noticed|forgot|misread|picked up|brought|booked|ordered|reserved|submitted|uploaded|"
    r"attached|dropped|spilled|crashed|split|burned|smeared|arrived|slid|tipped|forgotten)\b",
    flags=re.IGNORECASE,
)
_CONSEQUENCE_RE = re.compile(
    r"\b(because|so now|so|and now|ended up|which meant|had to|couldn't|could not|deadline|waiting|"
    r"running late|delayed|cost|missed|stuck|without it|fell apart|closed in)\b",
    flags=re.IGNORECASE,
)
_FEELING_RE = re.compile(
    r"\b(feel|felt|feeling|embarrassed|ashamed|guilty|upset|stressed|anxious|panicked|frustrated|"
    r"overwhelmed|furious|awful|defeated|rattled|mortified|crushed|angry|stunned|trapped)\b",
    flags=re.IGNORECASE,
)
_PERSONALIZATION_RE = re.compile(
    r"\b(fit me|fits me|fit how i|how i operate|my style|tailor|tailored|personalized|personality|"
    r"routine|coping style|what works for me|what suits me|for someone like me|pace that fits me|"
    r"framing that fits|adapt .* to me)\b",
    flags=re.IGNORECASE,
)
_UNRESOLVED_REFERENT_RE = re.compile(
    r"^(it|this|that|they|he|she)\b|"
    r"\b(she finally|he finally|they finally|it happened again|this happened again|that happened again|"
    r"she replied|he replied|they replied|about it|about that|after that|because of that)\b",
    flags=re.IGNORECASE,
)


class RouterAgent:
    def __init__(self):
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    def _has_unresolved_referents(self, seeker_post: str) -> bool:
        text = (seeker_post or "").strip()
        return bool(_UNRESOLVED_REFERENT_RE.search(text))

    def _is_self_contained_concrete_incident(self, seeker_post: str) -> bool:
        text = (seeker_post or "").strip()
        lowered = text.lower()
        has_first_person = any(token in lowered for token in [" i ", " my ", " me ", " i'm ", " i’d ", " i'd "])
        if lowered.startswith(("i ", "my ")):
            has_first_person = True
        return (
            len(text) >= 80
            and has_first_person
            and bool(_EVENT_MARKER_RE.search(text))
            and bool(_FEELING_RE.search(text))
            and bool(_CONSEQUENCE_RE.search(text))
        )

    def _requests_personalization(self, seeker_post: str) -> bool:
        return bool(_PERSONALIZATION_RE.search(seeker_post or ""))

    def _apply_router_guardrails(
        self,
        seeker_post: str,
        has_history: bool,
        has_ocean: bool,
    ) -> dict | None:
        if not seeker_post:
            return None

        self_contained_incident = self._is_self_contained_concrete_incident(seeker_post)
        unresolved = self._has_unresolved_referents(seeker_post)
        personalization_request = self._requests_personalization(seeker_post)

        if self_contained_incident and not unresolved:
            if has_ocean and not personalization_request:
                return {
                    "use_memory": False,
                    "use_ocean": False,
                    "use_rag": True,
                    "reasoning": (
                        "Guardrail: fully specified single-turn concrete incident; "
                        "do not use Memory or OCEAN unless personalization is explicitly requested."
                    ),
                }
            if has_history:
                return {
                    "use_memory": False,
                    "use_ocean": False,
                    "use_rag": True,
                    "reasoning": (
                        "Guardrail: fully specified single-turn concrete incident with no unresolved referents; "
                        "Memory is not needed."
                    ),
                }

        if self_contained_incident and has_ocean and not personalization_request:
            return {
                "use_memory": False,
                "use_ocean": False,
                "use_rag": True,
                "reasoning": (
                    "Guardrail: acute concrete incident without explicit personalization request; "
                    "OCEAN should remain off."
                ),
            }

        return None

    def _profile_significance_hint(self, ocean_profile: str) -> str:
        matches = _OCEAN_VALUE_RE.findall(ocean_profile or "")
        if not matches:
            return "Profile significance hint: profile unavailable."

        max_deviation = max(abs(float(value) - 0.5) for _, value in matches)
        if max_deviation >= 0.15:
            return (
                "Profile significance hint: Profile is clearly non-default "
                f"(max deviation from 0.5 = {max_deviation:.2f})."
            )
        return f"Profile significance hint: Profile is near default (max deviation from 0.5 = {max_deviation:.2f})."

    def decide(
        self,
        seeker_post: str,
        emotion: str,
        has_history: bool,
        has_ocean: bool,
        narrative: str = "",
        ocean_profile: str = "",
    ) -> dict:
        """Decide which components to activate for this turn."""
        guardrail = self._apply_router_guardrails(seeker_post, has_history, has_ocean)
        if guardrail is not None:
            return guardrail

        context_parts = []

        if has_history:
            context_parts.append("User has prior conversation history.")
            if narrative:
                context_parts.append(f"History summary: {narrative}")
        else:
            context_parts.append("New user, no prior history.")

        if has_ocean:
            context_parts.append(f"User OCEAN profile: {ocean_profile}")
            context_parts.append(self._profile_significance_hint(ocean_profile))
        else:
            context_parts.append("User has default OCEAN scores (all 0.5).")
            context_parts.append("Profile significance hint: Profile is near default.")

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
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            decisions = json.loads(raw)

            decisions["use_rag"] = True

            if decisions.get("use_memory", False) and decisions.get("use_ocean", False):
                decisions["use_ocean"] = False

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
