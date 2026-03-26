import asyncio
import base64
import json
import re
import threading
import traceback
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from core.dependencies import get_system
from core.engine import AgenticEmpathySystem

# Cuốn sổ tạm lưu bối cảnh Liệu pháp Ghế trống
empty_chair_sessions = {}

# Onboarding state tracking
onboarding_sessions = {}
# Structure: { user_id: { "step": 0, "answers": [] } }

# ── ONBOARDING HELPERS ───────────────────────────────────────────────────

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
        "One last thing — what would feel most helpful right now? "
        "Having someone listen and understand you, "
        "or helping you think through solutions and next steps?"
    ),
]

ONBOARDING_COMPLETE_MSG = (
    "Thank you for letting me get to know you. "
    "I'll keep everything you've shared in mind as we talk. "
    "I'm here for you — what would you like to talk about?"
)


def _is_new_user(system: AgenticEmpathySystem, user_id: str) -> bool:
    """Check if user has no meaningful OCEAN profile yet (all at default 0.5)."""
    if not system.memory or not system.memory.driver:
        return False
    try:
        profile = system.memory.get_user_profile(user_id)
        values = list(profile.values())
        return all(abs(v - 0.5) < 0.01 for v in values)
    except:
        return False


def _warm_start_ocean_from_text(
    system: AgenticEmpathySystem,
    user_id: str,
    combined_text: str,
    emotion: str,
):
    """Infer OCEAN from combined onboarding answers and save to Neo4j."""
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
    """Run ElevenLabs streaming in a thread, forward MP3 chunks to WebSocket as they arrive."""
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def producer():
        try:
            for chunk in voice_io.stream_speech_chunks(text):
                asyncio.run_coroutine_threadsafe(queue.put(chunk), loop)
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)  # sentinel

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
    print(f"🔌 Web Client [{user_id}] đã kết nối.")

    # Send first onboarding question if new user
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
            # 1. Nhận dữ liệu từ Frontend
            data = await websocket.receive_text()
            payload = json.loads(data)

            action = payload.get("action", "send_text")
            mode = payload.get("mode", "messaging")
            target_name = payload.get("target_name", "Hình bóng giả định")

            user_text = ""

            # --- GIAI ĐOẠN 1: XỬ LÝ ĐẦU VÀO ---
            if action == "start_recording":
                # Push-to-talk: start recording in background, wait for stop_recording
                recording_stop_event = threading.Event()
                recording_task = asyncio.create_task(
                    asyncio.to_thread(system.voice_io.record_audio_ptt, recording_stop_event)
                )
                await websocket.send_json({"type": "status", "content": "listening"})
                continue

            elif action == "stop_recording":
                # Signal recording to stop, await the result, then transcribe
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

            # ── ONBOARDING: 3-question flow for new users ────────────
            if mode == "messaging" and user_id in onboarding_sessions:
                session = onboarding_sessions[user_id]
                step = session["step"]

                # Save current answer
                session["answers"].append(user_text)
                session["step"] += 1

                if step < len(ONBOARDING_QUESTIONS) - 1:
                    # Still have questions — send next one
                    next_question = ONBOARDING_QUESTIONS[step + 1]
                    await websocket.send_json({
                        "type": "message",
                        "content": next_question,
                        "mode": mode,
                    })
                    await websocket.send_json({"type": "status", "content": "idle"})
                    continue
                else:
                    # All 3 answers collected — warm-start OCEAN
                    combined_text = " | ".join(session["answers"])

                    percept = await asyncio.to_thread(
                        system.perception.detect_emotion, combined_text
                    )
                    warmstart_emotion = percept.get("emotion", "neutral")

                    await asyncio.to_thread(
                        _warm_start_ocean_from_text,
                        system, user_id, combined_text, warmstart_emotion
                    )

                    # Clean up onboarding session
                    onboarding_sessions.pop(user_id, None)

                    await websocket.send_json({
                        "type": "message",
                        "content": ONBOARDING_COMPLETE_MSG,
                        "mode": mode,
                    })
                    await websocket.send_json({"type": "status", "content": "idle"})
                    continue
            # ─────────────────────────────────────────────────────────

            # --- GIAI ĐOẠN 2: PHÂN TÍCH CẢM XÚC (PERCEPTION) ---
            percept = await asyncio.to_thread(system.perception.detect_emotion, user_text)
            emotion = percept.get('emotion', 'Bình thường')
            
            await websocket.send_json({
                "type": "emotion_status", 
                "emotion": emotion, 
                "confidence": percept.get('confidence', 0.0)
            })

            # --- GIAI ĐOẠN 3: SUY NGHĨ (BRAIN) ---
            print(f"🗣️ Người dùng nói: {user_text}") 
            ai_response = ""

            try:
                if mode == "empty-chair":
                    # Bóc tách thông tin từ Form
                    if user_text.startswith("[SYSTEM_INIT]"):
                        target_match = re.search(r"TARGET:\s*(.*?)\s*\|", user_text)
                        rel_match = re.search(r"RELATIONSHIP:\s*(.*?)\s*\|", user_text)
                        need_match = re.search(r"UNSPOKEN_NEED:\s*(.*?)\s*\|", user_text)
                        msg_match = re.search(r"MESSAGE:\s*(.*)", user_text)

                        empty_chair_sessions[user_id] = {
                            "target_name": target_match.group(1).strip() if target_match else "Unknown",
                            "relationship": rel_match.group(1).strip() if rel_match else "",
                            "unspoken_need": need_match.group(1).strip() if need_match else ""
                        }
                        user_text = msg_match.group(1).strip() if msg_match else user_text

                    # Lấy bối cảnh ra
                    session_data = empty_chair_sessions.get(user_id, {
                        "target_name": "Người thương", 
                        "relationship": "Một người rất quan trọng", 
                        "unspoken_need": "Tôi muốn nói ra sự thật"
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
                    # Dành cho mode Nhắn tin thấu cảm & Tâm sự giọng nói
                    ai_response, _ = await system.process_brain_agentic(user_text, user_id, emotion)
                    
            except Exception as e:
                print("\n❌ LỖI NGẦM TẠI LANGCHAIN/NEO4J:")
                traceback.print_exc()
                ai_response = "Xin lỗi, đường truyền tâm trí của tôi đang bị nhiễu do lỗi hệ thống."

            print(f"🤖 AI trả lời: '{ai_response}'")

            # --- GIAI ĐOẠN 4: HIỂN THỊ LÊN MÀN HÌNH CHAT (RẤT QUAN TRỌNG) ---
            # Thiếu cái này thì Frontend sẽ không thấy chữ gì cả!
            await websocket.send_json({
                "type": "message", 
                "content": ai_response, 
                "mode": mode
            })

            # --- GIAI ĐOẠN 5: PHÁT GIỌNG NÓI (stream MP3 chunks to browser) ---
            use_voice = payload.get("use_voice", False) or (mode == "voice")
            if use_voice:
                await websocket.send_json({"type": "status", "content": "speaking"})
                await _stream_tts_to_ws(websocket, system.voice_io, ai_response)

            await websocket.send_json({"type": "status", "content": "idle"})

            # --- GIAI ĐOẠN 6: BACKGROUND TASKS ---
            asyncio.create_task(system.background_learning(user_text, user_id, emotion))
            asyncio.create_task(system.manage_reflection(user_id))

    except WebSocketDisconnect:
        print(f"🔌 Web Client [{user_id}] ngắt kết nối.")
    except Exception as e:
        print(f"❌ WebSocket Error: {e}")
        await websocket.send_json({"type": "status", "content": "idle"})