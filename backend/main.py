import sys
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# FIX TRIỆT ĐỂ CHO WINDOWS: Phải đặt trước khi import các module khác
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from core.dependencies import get_system
from api import chat, profile

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi động hệ thống
    system = get_system()
    yield
    # Đóng tài nguyên sạch sẽ khi tắt/reload
    system.close()

app = FastAPI(title="SoulMate API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(profile.router)