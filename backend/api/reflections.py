from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from core.dependencies import get_system
from core.engine import AgenticEmpathySystem
import asyncio

router = APIRouter()


def _delete_reflection_node(driver, user_id: str, reflection_id: str) -> bool:
    """Detach-delete a Reflection owned by user_id. Returns True if a node was removed.

    Follows the same `driver.session()` pattern as GraphMemory.get_reflections /
    add_reflection. The match is scoped through the HAS_REFLECTION edge so a user
    can only delete their own reflections.
    """
    query = """
    MATCH (u:User {id: $user_id})-[:HAS_REFLECTION]->(r:Reflection {id: $reflection_id})
    WITH r, r.id AS rid
    DETACH DELETE r
    RETURN rid
    """
    with driver.session() as session:
        result = session.run(query, user_id=user_id, reflection_id=reflection_id)
        return result.single() is not None

class ReflectionCreate(BaseModel):
    title: str
    body: str
    mood: str = ""

@router.post("/api/reflections/{user_id}")
async def create_reflection(
    user_id: str,
    payload: ReflectionCreate,
    system: AgenticEmpathySystem = Depends(get_system)
):
    entry = await asyncio.to_thread(
        system.memory.add_reflection,
        user_id, payload.title, payload.body, payload.mood
    )
    return entry

@router.get("/api/reflections/{user_id}")
async def list_reflections(
    user_id: str,
    system: AgenticEmpathySystem = Depends(get_system)
):
    entries = await asyncio.to_thread(
        system.memory.get_reflections, user_id
    )
    return {"reflections": entries}

@router.delete("/api/reflections/{user_id}/{reflection_id}")
async def delete_reflection(
    user_id: str,
    reflection_id: str,
    system: AgenticEmpathySystem = Depends(get_system)
):
    driver = system.memory.driver
    if driver is None:
        raise HTTPException(status_code=500, detail="Memory store unavailable")
    try:
        deleted = await asyncio.to_thread(
            _delete_reflection_node, driver, user_id, reflection_id
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"⚠️ Reflection Delete Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete reflection")
    if not deleted:
        raise HTTPException(status_code=404, detail="Reflection not found")
    return {"deleted": True, "id": reflection_id}
