import asyncio
import json
import re
import traceback # Import thêm thư viện này để in lỗi đỏ nếu có
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from core.dependencies import get_system
from core.engine import AgenticEmpathySystem

# Cuốn sổ tạm lưu bối cảnh Liệu pháp Ghế trống
empty_chair_sessions = {}

router = APIRouter()

@router.websocket("/ws/chat/{user_id}")
async def websocket_chat(
    websocket: WebSocket, 
    user_id: str, 
    system: AgenticEmpathySystem = Depends(get_system)
):
    await websocket.accept()
    print(f"🔌 Web Client [{user_id}] đã kết nối.")
    
    try:
        while True:
            # 1. Nhận dữ liệu từ Frontend
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            action = payload.get("action", "send_text")
            mode = payload.get("mode", "messaging") 
            target_name = payload.get("target_name", "Hình bóng giả định")
            
            user_text = ""

            # --- GIAI ĐOẠN 1: XỬ LÝ ĐẦU VÀO (MICROPHONE HOẶC TEXT) ---
            if action == "start_recording":
                await websocket.send_json({"type": "status", "content": "listening"})
                audio_file = await asyncio.to_thread(system.voice_io.record_audio, duration=4)
                user_text = await asyncio.to_thread(system.voice_io.transcribe, audio_file)
                await websocket.send_json({"type": "user_speech", "content": user_text})
            else:
                user_text = payload.get("text", "").strip()

            if not user_text:
                await websocket.send_json({"type": "status", "content": "idle"})
                continue

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
                    ai_response = await system.process_brain(user_text, user_id, emotion)
                    
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

            # --- GIAI ĐOẠN 5: PHÁT GIỌNG NÓI (PYGAME) ---
            use_voice = payload.get("use_voice", False) or (mode == "voice")
            if use_voice:
                await websocket.send_json({"type": "status", "content": "speaking"})
                await asyncio.to_thread(system.voice_io.speak_text, ai_response)

            await websocket.send_json({"type": "status", "content": "idle"})

            # --- GIAI ĐOẠN 6: BACKGROUND TASKS ---
            asyncio.create_task(system.background_learning(user_text, user_id, emotion))
            asyncio.create_task(system.manage_reflection(user_id))

    except WebSocketDisconnect:
        print(f"🔌 Web Client [{user_id}] ngắt kết nối.")
    except Exception as e:
        print(f"❌ WebSocket Error: {e}")
        await websocket.send_json({"type": "status", "content": "idle"})