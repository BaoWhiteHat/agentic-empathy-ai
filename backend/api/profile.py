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

# Ví dụ API trả về điểm OCEAN từ Neo4j
@router.get("/profile/ocean/{user_id}")
async def get_ocean_scores(user_id: str, system = Depends(get_system)):
    try:
        # Lấy chỉ số từ bộ nhớ đồ thị
        scores = system.memory.get_user_profile(user_id) 
        return scores 
        # API phải trả về JSON dạng: 
        # {"openness": 0.52, "conscientiousness": 0.5, "extraversion": 0.47, "agreeableness": 0.51, "neuroticism": 0.51}
    except Exception as e:
        return {"error": str(e)}