from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.dependencies import get_system
from api import chat, profile

# Quản lý vòng đời: Khởi động hệ thống AI khi bật server và đóng kết nối Neo4j khi tắt
@asynccontextmanager
async def lifespan(app: FastAPI):
    system = get_system()
    yield
    system.close()

# Đây chính là biến 'app' mà Uvicorn đang tìm kiếm!
app = FastAPI(title="SoulMate API", lifespan=lifespan)

# Cấu hình CORS để Frontend (Web) có thể gọi được API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lắp ráp (Include) các routers từ thư mục api/
app.include_router(chat.router)
app.include_router(profile.router)

if __name__ == "__main__":
    import uvicorn
    import sys
    import asyncio
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
        
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)