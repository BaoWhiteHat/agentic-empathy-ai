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
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            user_text = payload.get("text", "").strip()
            mode = payload.get("mode", "soulmate") 
            target_name = payload.get("target_name", "Unknown")
            # Nhận cờ bật/tắt giọng nói từ Frontend (mặc định là False - Tắt)
            use_voice = payload.get("use_voice", False) 

            if not user_text: continue

            # 1. Perception
            percept = await asyncio.to_thread(system.perception.detect_emotion, user_text)
            emotion = percept['emotion']
            
            await websocket.send_json({
                "type": "emotion_status", 
                "emotion": emotion, 
                "confidence": percept['confidence']
            })

            # 2. Xử lý Logic (SoulMate / Empty Chair)
            ai_response = ""
            if mode == "empty_chair":
                ai_response = await asyncio.to_thread(
                    system.empty_chair.generate_response,
                    user_id, target_name, user_text, emotion
                )
            else:
                ai_response = await system.process_brain(user_text, user_id, emotion)

            # 3. Phản hồi Text
            await websocket.send_json({
                "type": "message",
                "role": "ai",
                "content": ai_response
            })
            
            # 4. Phát âm thanh (CHỈ PHÁT KHI FRONTEND YÊU CẦU)
            if use_voice:
                await asyncio.to_thread(system.voice_io.speak_text, ai_response)

            # 5. Background Tasks (Luồng 2)
            asyncio.create_task(system.background_learning(user_text, user_id, emotion))
            asyncio.create_task(system.manage_reflection(user_id))

    except WebSocketDisconnect:
        print(f"🔌 Web Client [{user_id}] ngắt kết nối.")
    except Exception as e:
        print(f"❌ WebSocket Error: {e}")
        await websocket.send_json({"type": "error", "content": "Lỗi hệ thống ngầm."})