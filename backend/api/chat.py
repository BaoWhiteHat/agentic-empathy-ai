import asyncio
import base64
import json
import re
import threading
import traceback
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from core.dependencies import get_system
from core.engine import AgenticEmpathySystem

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
                    if user_text.startswith("[SYSTEM_INIT]"):
                        target_match = re.search(r"TARGET:\s*(.*?)\s*\|", user_text)
                        rel_match = re.search(r"RELATIONSHIP:\s*(.*?)\s*\|", user_text)
                        need_match = re.search(r"UNSPOKEN_NEED:\s*(.*?)\s*\|", user_text)
                        msg_match = re.search(r"MESSAGE:\s*(.*)", user_text)

                        empty_chair_sessions[user_id] = {
                            "target_name": target_match.group(1).strip() if target_match else "Unknown",
                            "relationship": rel_match.group(1).strip() if rel_match else "",
                            "unspoken_need": need_match.group(1).strip() if need_match else "",
                        }
                        user_text = msg_match.group(1).strip() if msg_match else user_text

                    safety = system.safety.classifier.classify(user_text, emotion, mode="empty-chair")
                    if safety.risk_type == "self_harm_or_suicide":
                        skip_background_learning = True
                        ai_response = system.safety.policy.immediate_response(
                            safety.risk_type, user_text, emotion
                        )
                        if system.memory and system.memory.driver:
                            safe_summary = system.safety.sanitizer.build_safe_summary(
                                user_input=user_text,
                                emotion=emotion,
                                risk_type=safety.risk_type,
                                ai_response=ai_response,
                            )
                            system.memory.add_turn(
                                user_id,
                                safe_summary,
                                emotion,
                                ai_response,
                                risk_level=safety.risk_level,
                                risk_type=safety.risk_type,
                                raw_stored=False,
                            )
                    else:
                        session_data = empty_chair_sessions.get(user_id, {
                            "target_name": "Người thương",
                            "relationship": "Một người rất quan trọng",
                            "unspoken_need": "Tôi muốn nói ra sự thật",
                        })
                        ai_response = await asyncio.to_thread(
                            system.empty_chair.generate_response,
                            user_id=user_id,
                            target_name=session_data["target_name"],
                            relationship=session_data["relationship"],
                            unspoken_need=session_data["unspoken_need"],
                            user_input=user_text,
                            emotion=emotion
                        )
                else:
                    ai_response, routing_info, safety_info = await system.process_brain_agentic(
                        user_text,
                        user_id,
                        emotion,
                        mode=mode,
                    )
                    skip_background_learning = safety_info.get("risk_type") == "self_harm_or_suicide"
                    _ = routing_info, safety_info

            except Exception:
                print("\nUnexpected error during chat processing:")
                traceback.print_exc()
                ai_response = "Xin lỗi, đường truyền tâm trí của tôi đang bị nhiễu do lỗi hệ thống."

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
