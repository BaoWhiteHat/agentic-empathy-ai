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


# OCEAN scores + narrative reflection in one payload (consumed by the Insights/Today screens).
@router.get("/api/ocean/{user_id}")
async def get_ocean_profile(user_id: str, system: AgenticEmpathySystem = Depends(get_system)):
    default = {
        "openness": 0.5, "conscientiousness": 0.5, "extraversion": 0.5,
        "agreeableness": 0.5, "neuroticism": 0.5, "narrative": "",
    }
    if not (system and system.memory and system.memory.driver):
        return default
    try:
        scores = await asyncio.to_thread(system.memory.get_user_profile, user_id)
        narrative = await asyncio.to_thread(system.memory.get_narrative_profile, user_id)
        # reflect_on_history() only runs after ~10 turns; until then surface an empty
        # string so the frontend can show its "not enough conversations yet" state.
        if not narrative or narrative.strip() == "No narrative yet.":
            narrative = ""
        return {**scores, "narrative": narrative}
    except Exception as e:
        return {**default, "error": str(e)}