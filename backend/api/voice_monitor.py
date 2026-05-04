import asyncio
from typing import Literal

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel


MonitorEventType = Literal["status", "emotion_status", "user_speech", "message"]
MonitorStatus = Literal[
    "listening",
    "processing",
    "transcribing",
    "thinking",
    "speaking",
    "idle",
]


class VoiceMonitorEvent(BaseModel):
    type: MonitorEventType
    content: str | None = None
    status: MonitorStatus | None = None
    emotion: str | None = None
    confidence: float | None = None
    mode: str = "voice"


class VoiceMonitorManager:
    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        connections = self.active_connections.get(user_id)
        if not connections:
            return

        connections.discard(websocket)
        if not connections:
            self.active_connections.pop(user_id, None)

    async def broadcast(self, user_id: str, event: dict):
        stale_connections: list[WebSocket] = []

        for websocket in list(self.active_connections.get(user_id, set())):
            try:
                await websocket.send_json(event)
            except Exception:
                stale_connections.append(websocket)

        for websocket in stale_connections:
            self.disconnect(user_id, websocket)

    def connection_count(self, user_id: str) -> int:
        return len(self.active_connections.get(user_id, set()))


router = APIRouter()
manager = VoiceMonitorManager()


@router.websocket("/ws/voice-monitor/{user_id}")
async def voice_monitor_ws(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    print(f"Voice monitor client [{user_id}] connected.")

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
        print(f"Voice monitor client [{user_id}] disconnected.")


@router.post("/api/voice-monitor/{user_id}/event")
async def publish_voice_monitor_event(user_id: str, event: VoiceMonitorEvent):
    payload = event.model_dump(exclude_none=True)
    payload["mode"] = "voice"

    if payload["type"] == "status" and "content" not in payload and "status" in payload:
        payload["content"] = payload["status"]

    asyncio.create_task(manager.broadcast(user_id, payload))

    return {
        "ok": True,
        "user_id": user_id,
        "connected_clients": manager.connection_count(user_id),
    }
