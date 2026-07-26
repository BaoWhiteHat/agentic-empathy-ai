"""
Web control for the standalone physical voice companion.
-------------------------------------------------------
Lets the web UI start/stop `voice_companion.py` as a subprocess WITHOUT
touching the script itself. The script remains fully launchable from a
terminal (`uv run python voice_companion.py`) — these endpoints just spawn
that same script with the current Python interpreter (`sys.executable`).
"""

import os
import subprocess

from fastapi import APIRouter
from pydantic import BaseModel


class StartRequest(BaseModel):
    user_id: str = "Ghostman"

router = APIRouter()

# Module-level handle to the running companion subprocess (None when offline).
_process: subprocess.Popen | None = None

# voice_companion.py lives in backend/ (one level up from backend/api/).
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SCRIPT = os.path.join(_BACKEND_DIR, "voice_companion.py")


def _is_running() -> bool:
    """True only if the subprocess exists and hasn't exited on its own.

    poll() returns None while the process is alive and the exit code once it
    has terminated (e.g. serial disconnect). When it has died, clear the
    handle so a fresh start can spawn a new one.
    """
    global _process
    if _process is None:
        return False
    if _process.poll() is not None:
        _process = None
        return False
    return True


@router.get("/api/companion/status")
async def companion_status():
    return {"running": _is_running()}


@router.post("/api/companion/start")
async def companion_start(body: StartRequest = StartRequest()):
    global _process
    if _is_running():
        return {"ok": True}
    # Spawn via `uv run` (not sys.executable directly) so the companion runs
    # inside the project virtualenv with all deps (e.g. pyserial). Explicitly
    # set ESP32_PORT/USE_ESP32 in the child env so serial output goes to the
    # ESP32 instead of silently falling back to the laptop speaker.
    # COMPANION_USER_ID ties the device session to the same Neo4j user as the web.
    _process = subprocess.Popen(
        ["uv", "run", "python", "voice_companion.py"],
        cwd=_BACKEND_DIR,
        env={**os.environ, "ESP32_PORT": "COM5", "USE_ESP32": "True", "COMPANION_USER_ID": body.user_id},
    )
    return {"ok": True}


@router.post("/api/companion/stop")
async def companion_stop():
    global _process
    if _process is not None:
        if _process.poll() is None:
            _process.terminate()
        _process = None
    return {"ok": True}
