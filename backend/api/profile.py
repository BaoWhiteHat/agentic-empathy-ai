import asyncio
from fastapi import APIRouter, Depends
from core.dependencies import get_system
from core.engine import AgenticEmpathySystem

router = APIRouter()

@router.get("/api/v1/profile/{user_id}")
async def get_radar_data(user_id: str, system: AgenticEmpathySystem = Depends(get_system)):
    if system and system.memory and system.memory.driver:
        profile = await asyncio.to_thread(system.memory.get_user_profile, user_id)
        return {"user_id": user_id, "traits": profile}
    return {"error": "Memory DB chưa sẵn sàng"}