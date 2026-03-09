import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from core.dependencies import get_system
from core.engine import AgenticEmpathySystem

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

            # --- GIAI ĐOẠN 1: XỬ LÝ ĐẦU VÀO (MICROPHONE) ---
            if action == "start_recording":
                await websocket.send_json({"type": "status", "content": "listening"})
                
                # Thu âm (4 giây)
                audio_file = await asyncio.to_thread(system.voice_io.record_audio, duration=4)
                
                # Chuyển giọng nói -> Chữ
                user_text = await asyncio.to_thread(system.voice_io.transcribe, audio_file)
                
                # Gửi chữ vừa nghe được về Web để hiện khung chat
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
            if mode == "empty-chair":
                ai_response = await asyncio.to_thread(
                    system.empty_chair.generate_response,
                    user_id, target_name, user_text, emotion
                )
            else:
                ai_response = await system.process_brain(user_text, user_id, emotion)

            # --- GIAI ĐOẠN 4: HIỂN THỊ CHỮ NGAY LẬP TỨC ---
            # Ghostman sẽ thấy chữ hiện lên ngay tại bước này!
            await websocket.send_json({
                "type": "message",
                "role": "ai",
                "content": ai_response,
                "mode": mode
            })
            
            # --- GIAI ĐOẠN 5: PHÁT GIỌNG NÓI (PYGAME) ---
            use_voice = payload.get("use_voice", False) or (mode == "voice")
            if use_voice:
                await websocket.send_json({"type": "status", "content": "speaking"})
                
                # Đổi về speak_text dùng Pygame (Bản ổn định cho Windows)
                # Dùng await ở đây để AI nói xong mới báo 'idle'
                await asyncio.to_thread(system.voice_io.speak_text, ai_response)

            # Hoàn tất quy trình
            await websocket.send_json({"type": "status", "content": "idle"})

            # --- GIAI ĐOẠN 6: BACKGROUND TASKS ---
            asyncio.create_task(system.background_learning(user_text, user_id, emotion))
            asyncio.create_task(system.manage_reflection(user_id))

    except WebSocketDisconnect:
        print(f"🔌 Web Client [{user_id}] ngắt kết nối.")
    except Exception as e:
        print(f"❌ WebSocket Error: {e}")
        await websocket.send_json({"type": "status", "content": "idle"})
        await websocket.send_json({"type": "error", "content": "Lỗi hệ thống ngầm."})