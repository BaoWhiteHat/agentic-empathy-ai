import asyncio
import base64
import json
import re
import threading
import time
import traceback
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from core.dependencies import get_system
from core.engine import AgenticEmpathySystem
from agent.emptychair_safety import EmptyChairSafetyDecision

ELEVATED_MODE_DURATION_SECONDS = 30 * 60
BREATHING_LOCKOUT_SECONDS = 15
DISTILBERT_TIMEOUT_SECONDS = 3.0

EMPTY_CHAIR_LIFECYCLE_ACTIONS = frozenset({
    "resume_roleplay",
    "switch_to_support",
    "end_session",
    "check_elevated_mode",
    "show_reentry_options",
})

empty_chair_sessions = {}
onboarding_sessions = {}

ONBOARDING_QUESTIONS = [
    (
        "Before we start, I'd love to get to know you a little better.\n\n"
        "What's been weighing on you lately? "
        "Feel free to share as much or as little as you'd like."
    ),
    (
        "Thank you for sharing that.\n\n"
        "When things get tough, do you usually talk it out with someone, "
        "or do you tend to process things on your own?"
    ),
    (
        "That really helps me understand you better.\n\n"
        "One last thing - what would feel most helpful right now? "
        "Having someone listen and understand you, "
        "or helping you think through solutions and next steps?"
    ),
]

ONBOARDING_COMPLETE_MSG = (
    "Thank you for letting me get to know you. "
    "I'll keep everything you've shared in mind as we talk. "
    "I'm here for you - what would you like to talk about?"
)


def _default_empty_chair_session() -> dict:
    return {
        "target_name": "Someone important",
        "relationship": "A person who matters deeply to me",
        "unspoken_need": "I want to speak my truth",
        "crisis_timestamp": None,
        "elevated_mode_until": None,
        "post_crisis_lockout": False,
        "support_mode": False,
        "crisis_count": 0,
    }


def _get_or_create_session(user_id: str) -> dict:
    session = empty_chair_sessions.get(user_id)
    if session is None:
        session = _default_empty_chair_session()
        empty_chair_sessions[user_id] = session
        return session
    # Backfill any missing keys on legacy sessions without overwriting existing values.
    for key, value in _default_empty_chair_session().items():
        session.setdefault(key, value)
    return session


def _build_init_synthetic_decision() -> EmptyChairSafetyDecision:
    return EmptyChairSafetyDecision(
        risk_type="normal_support",
        risk_level="low",
        action="normal_roleplay",
        predicted_label="system_init",
        suicidewatch_probability=0.0,
        method="init_bypass",
        reason="System init payload — safety bypassed.",
    )


def _build_timeout_synthetic_decision() -> EmptyChairSafetyDecision:
    return EmptyChairSafetyDecision(
        risk_type="high_distress",
        risk_level="medium",
        action="safe_roleplay",
        predicted_label="timeout_fallback",
        suicidewatch_probability=0.0,
        method="timeout_fallback",
        reason="DistilBERT inference timed out — defaulting to safe roleplay.",
    )


def _is_in_elevated_window(session: dict, now: float) -> bool:
    until = session.get("elevated_mode_until")
    return bool(until and now < until)


async def _send_reentry_choices(websocket: WebSocket) -> None:
    await websocket.send_json({
        "type": "re_entry_choice",
        "prompt": "How would you like to keep going?",
        "buttons": [
            {"action": "resume_roleplay", "label": "Continue with roleplay", "tone": "primary"},
            {"action": "switch_to_support", "label": "Just talk normally", "tone": "secondary"},
            {"action": "end_session", "label": "End session for now", "tone": "neutral"},
        ],
    })


async def _handle_empty_chair_action(
    *,
    websocket: WebSocket,
    user_id: str,
    action: str,
    session_start_time: float,
) -> None:
    session = _get_or_create_session(user_id)
    now = time.time()

    if action == "check_elevated_mode":
        if _is_in_elevated_window(session, now):
            await websocket.send_json({
                "type": "elevated_mode",
                "active": True,
                "until_timestamp": session["elevated_mode_until"],
                "reason": "crisis_persisted",
            })
        if session.get("post_crisis_lockout"):
            await _send_reentry_choices(websocket)
        return

    if action == "show_reentry_options":
        await _send_reentry_choices(websocket)
        return

    if action == "resume_roleplay":
        session["post_crisis_lockout"] = False
        session["support_mode"] = False
        await websocket.send_json({
            "type": "system_message",
            "text": f"You're back in the conversation with {session['target_name']}.",
        })
        return

    if action == "switch_to_support":
        session["post_crisis_lockout"] = False
        session["support_mode"] = True
        await websocket.send_json({
            "type": "system_message",
            "text": "I'm here to talk with you directly — no roleplay. Take your time.",
        })
        return

    if action == "end_session":
        crisis_count = session.get("crisis_count", 0)
        await websocket.send_json({
            "type": "safety_summary",
            "session_duration": max(0.0, now - session_start_time),
            "crisis_count": crisis_count,
        })
        empty_chair_sessions.pop(user_id, None)
        return


def _is_new_user(system: AgenticEmpathySystem, user_id: str) -> bool:
    if not system.memory or not system.memory.driver:
        return False
    try:
        profile = system.memory.get_user_profile(user_id)
        values = list(profile.values())
        return all(abs(v - 0.5) < 0.01 for v in values)
    except Exception:
        return False


def _warm_start_ocean_from_text(
    system: AgenticEmpathySystem,
    user_id: str,
    combined_text: str,
    emotion: str,
):
    if not system.memory or not system.memory.driver:
        return
    try:
        default_profile = (
            "openness: 0.5, conscientiousness: 0.5, "
            "extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5"
        )
        initial_traits = system.inference.infer_traits(
            text=combined_text,
            emotion=emotion,
            response_time="normal",
            past_profile=default_profile
        )
        system.memory.update_user_profile(user_id, initial_traits)
        print(f"OCEAN warm-started for [{user_id}]: {initial_traits}")
    except Exception as e:
        print(f"OCEAN warm-start failed: {e}")


async def _stream_tts_to_ws(websocket: WebSocket, voice_io, text: str):
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def producer():
        try:
            for chunk in voice_io.stream_speech_chunks(text):
                asyncio.run_coroutine_threadsafe(queue.put(chunk), loop)
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)

    threading.Thread(target=producer, daemon=True).start()

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        await websocket.send_json({
            "type": "audio_chunk",
            "data": base64.b64encode(chunk).decode("utf-8")
        })
    await websocket.send_json({"type": "audio_end"})


router = APIRouter()


@router.websocket("/ws/chat/{user_id}")
async def websocket_chat(
    websocket: WebSocket,
    user_id: str,
    system: AgenticEmpathySystem = Depends(get_system)
):
    await websocket.accept()
    session_start_time = time.time()
    print(f"Web Client [{user_id}] connected.")

    if _is_new_user(system, user_id):
        onboarding_sessions[user_id] = {"step": 0, "answers": []}
        await websocket.send_json({
            "type": "message",
            "content": ONBOARDING_QUESTIONS[0],
            "mode": "messaging",
        })
        print(f"Onboarding started for new user [{user_id}]")

    recording_stop_event: threading.Event | None = None
    recording_task: asyncio.Task | None = None

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)

            action = payload.get("action", "send_text")
            mode = payload.get("mode", "messaging")
            user_text = ""

            if action in EMPTY_CHAIR_LIFECYCLE_ACTIONS:
                await _handle_empty_chair_action(
                    websocket=websocket,
                    user_id=user_id,
                    action=action,
                    session_start_time=session_start_time,
                )
                continue

            if action == "start_recording":
                recording_stop_event = threading.Event()
                recording_task = asyncio.create_task(
                    asyncio.to_thread(system.voice_io.record_audio_ptt, recording_stop_event)
                )
                await websocket.send_json({"type": "status", "content": "listening"})
                continue

            if action == "stop_recording":
                if recording_stop_event:
                    recording_stop_event.set()
                audio_file = await recording_task if recording_task else None
                recording_stop_event = None
                recording_task = None
                if audio_file:
                    user_text = await asyncio.to_thread(system.voice_io.transcribe, audio_file)
                await websocket.send_json({"type": "user_speech", "content": user_text})
            else:
                user_text = payload.get("text", "").strip()

            if not user_text:
                await websocket.send_json({"type": "status", "content": "idle"})
                continue

            if mode == "messaging" and user_id in onboarding_sessions:
                session = onboarding_sessions[user_id]
                step = session["step"]
                session["answers"].append(user_text)
                session["step"] += 1

                if step < len(ONBOARDING_QUESTIONS) - 1:
                    await websocket.send_json({
                        "type": "message",
                        "content": ONBOARDING_QUESTIONS[step + 1],
                        "mode": mode,
                    })
                    await websocket.send_json({"type": "status", "content": "idle"})
                    continue

                combined_text = " | ".join(session["answers"])
                percept = await asyncio.to_thread(system.perception.detect_emotion, combined_text)
                warmstart_emotion = percept.get("emotion", "neutral")

                await asyncio.to_thread(
                    _warm_start_ocean_from_text,
                    system,
                    user_id,
                    combined_text,
                    warmstart_emotion,
                )

                onboarding_sessions.pop(user_id, None)
                await websocket.send_json({
                    "type": "message",
                    "content": ONBOARDING_COMPLETE_MSG,
                    "mode": mode,
                })
                await websocket.send_json({"type": "status", "content": "idle"})
                continue

            is_init = mode == "empty-chair" and user_text.startswith("[SYSTEM_INIT]")

            if mode == "empty-chair" and not is_init:
                session = _get_or_create_session(user_id)
                if session.get("post_crisis_lockout"):
                    await websocket.send_json({
                        "type": "system_message",
                        "text": "Please pick one of the options above to continue.",
                    })
                    await _send_reentry_choices(websocket)
                    await websocket.send_json({"type": "status", "content": "idle"})
                    continue

            percept = await asyncio.to_thread(system.perception.detect_emotion, user_text)
            emotion = percept.get("emotion", "neutral")

            await websocket.send_json({
                "type": "emotion_status",
                "emotion": emotion,
                "confidence": percept.get("confidence", 0.0)
            })

            print(f"User said: {user_text}")
            ai_response = ""
            skip_background_learning = False

            try:
                if mode == "empty-chair":
                    session = _get_or_create_session(user_id)

                    if is_init:
                        target_match = re.search(r"TARGET:\s*(.*?)\s*\|", user_text)
                        rel_match = re.search(r"RELATIONSHIP:\s*(.*?)\s*\|", user_text)
                        need_match = re.search(r"UNSPOKEN_NEED:\s*(.*?)\s*\|", user_text)
                        msg_match = re.search(r"MESSAGE:\s*(.*)", user_text)

                        # Preserve any existing crisis/elevated/lockout fields across re-init.
                        session["target_name"] = target_match.group(1).strip() if target_match else "Someone important"
                        session["relationship"] = rel_match.group(1).strip() if rel_match else "A person who matters deeply to me"
                        session["unspoken_need"] = need_match.group(1).strip() if need_match else "I want to speak my truth"
                        user_text = msg_match.group(1).strip() if msg_match else user_text

                    # Skip safety on SYSTEM_INIT — the Reddit-trained classifier
                    # misfires on short/non-English boilerplate.
                    ec_safety = None
                    if not is_init and system.empty_chair.emptychair_safety is not None:
                        try:
                            ec_safety = await asyncio.wait_for(
                                asyncio.to_thread(
                                    system.empty_chair.emptychair_safety.decide, user_text
                                ),
                                timeout=DISTILBERT_TIMEOUT_SECONDS,
                            )
                        except asyncio.TimeoutError:
                            ec_safety = _build_timeout_synthetic_decision()
                            print("EmptyChair safety: DistilBERT timed out — using safe_roleplay fallback")

                        await websocket.send_json({
                            "type": "safety_decision",
                            "action": ec_safety.action,
                            "method": ec_safety.method,
                            "risk_level": ec_safety.risk_level,
                            "suicidewatch_probability": ec_safety.suicidewatch_probability,
                        })
                        print(f"EmptyChair safety: {ec_safety}")

                    if ec_safety is not None and ec_safety.action == "stop_roleplay":
                        # ── Crisis path ──
                        skip_background_learning = True
                        now = time.time()
                        session["crisis_timestamp"] = now
                        session["elevated_mode_until"] = now + ELEVATED_MODE_DURATION_SECONDS
                        session["post_crisis_lockout"] = True
                        session["support_mode"] = False
                        session["crisis_count"] = session.get("crisis_count", 0) + 1

                        await websocket.send_json({
                            "type": "crisis_mode",
                            "lockout_seconds": BREATHING_LOCKOUT_SECONDS,
                            "show_breathing": True,
                        })
                        await websocket.send_json({
                            "type": "elevated_mode",
                            "active": True,
                            "until_timestamp": session["elevated_mode_until"],
                            "reason": "crisis_detected",
                        })

                        ai_response = system.empty_chair.emptychair_safety.crisis_response()

                        if system.memory and system.memory.driver:
                            system.memory.add_turn(
                                user_id,
                                "User expressed possible self-harm or suicide risk during EmptyChair mode.",
                                emotion,
                                ai_response,
                                risk_level=ec_safety.risk_level,
                                risk_type=ec_safety.risk_type,
                                raw_stored=False,
                            )

                    elif session.get("support_mode") and not is_init:
                        # ── Neutral companion voice (post-crisis switch_to_support) ──
                        ai_response, _routing, support_safety = await system.process_brain_agentic(
                            user_text,
                            user_id,
                            emotion,
                            mode="empty-chair",
                        )
                        if support_safety.get("risk_type") == "self_harm_or_suicide":
                            skip_background_learning = True

                    else:
                        # ── Normal / safe_roleplay: reuse precomputed decision ──
                        precomputed = ec_safety if not is_init else _build_init_synthetic_decision()
                        ai_response = await asyncio.to_thread(
                            system.empty_chair.generate_response,
                            user_id=user_id,
                            target_name=session["target_name"],
                            relationship=session["relationship"],
                            unspoken_need=session["unspoken_need"],
                            user_input=user_text,
                            emotion=emotion,
                            _precomputed_safety=precomputed,
                        )
                else:
                    ai_response, _routing_info, safety_info = await system.process_brain_agentic(
                        user_text,
                        user_id,
                        emotion,
                        mode=mode,
                    )
                    skip_background_learning = safety_info.get("risk_type") == "self_harm_or_suicide"

            except Exception:
                print("\nUnexpected error during chat processing:")
                traceback.print_exc()
                ai_response = "Sorry — I hit a system error and lost the thread. Could you try again?"

            print(f"AI replied: '{ai_response}'")

            await websocket.send_json({
                "type": "message",
                "content": ai_response,
                "mode": mode
            })

            use_voice = payload.get("use_voice", False) or (mode == "voice")
            if use_voice:
                await websocket.send_json({"type": "status", "content": "speaking"})
                await _stream_tts_to_ws(websocket, system.voice_io, ai_response)

            await websocket.send_json({"type": "status", "content": "idle"})

            if not skip_background_learning:
                asyncio.create_task(system.background_learning(user_text, user_id, emotion))
            asyncio.create_task(system.manage_reflection(user_id))

    except WebSocketDisconnect:
        print(f"Web Client [{user_id}] disconnected.")
    except Exception as e:
        print(f"WebSocket Error: {e}")
        await websocket.send_json({"type": "status", "content": "idle"})