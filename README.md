# SoulMate – Agentic AI Companion 🤖💙

> Một người bạn đồng hành AI thấu cảm, được xây dựng trên kiến trúc Multi-Agent với trí nhớ đồ thị, định tuyến thông minh và giao tiếp đa phương thức.

Phát triển bởi **Lê Quốc Bảo** — Sinh viên Trường Đại học Công nghệ Thông tin (UIT).

---

## ✨ Tính Năng Nổi Bật

| Tính năng                       | Mô tả                                                                |
| ------------------------------- | -------------------------------------------------------------------- |
| 🧠 **Multi-Agent Architecture** | 6 agent chuyên biệt phối hợp để nhận thức, định tuyến, suy luận và phản hồi |
| 🔀 **Agentic Router**          | RouterAgent tự động chọn pipeline tối ưu cho từng tin nhắn (RAG ± Memory/OCEAN) |
| 🗂️ **Graph Memory**             | Neo4j lưu hồ sơ tâm lý OCEAN (EMA smoothing) & lịch sử hội thoại theo thời gian thực |
| 📚 **RAG Knowledge Base**       | ChromaDB + EPITOME/ESConv dataset cung cấp ví dụ thấu cảm cho Dialogue Agent |
| ⚡ **Real-time WebSocket**      | Chat liên tục, độ trễ thấp qua 3 chế độ: nhắn tin, giọng nói, ghế trống |
| 🎙️ **Voice I/O**                | Giao tiếp bằng giọng nói (OpenAI Whisper STT + ElevenLabs TTS)       |
| 🛋️ **Empty Chair Therapy**      | Agent mô phỏng liệu pháp Gestalt "Chiếc ghế trống"                  |
| 🌡️ **Warm-start Onboarding**   | 3 câu hỏi khởi đầu để xây dựng hồ sơ OCEAN ban đầu cho user mới    |

---

## 🏗️ Kiến Trúc Hệ Thống

```
                        ┌─────────────────────┐
                        │     User Message     │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │       Perception Agent        │
                    │       perception.py           │
                    │                               │
                    │  1. Keyword matching          │
                    │  2. RoBERTa inference         │
                    │     (roberta-base-go_emotions)│
                    │                               │
                    │  Output: emotion_label,       │
                    │          emotion_score        │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │         Router Agent          │
                    │         router.py             │
                    │                               │
                    │  GPT-4o-mini (temperature=0)  │
                    │                               │
                    │  Rules:                       │
                    │  • RAG always ON              │
                    │  • At most ONE secondary:     │
                    │    Memory OR OCEAN            │
                    │  • Memory > OCEAN priority    │
                    │                               │
                    │  Output: routing decision     │
                    │  (use_rag, use_memory,        │
                    │   use_ocean)                  │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │        Graph Memory         │
                    │        memory.py            │
                    │                             │
                    │  Reads from Neo4j:          │
                    │  • conversation history     │
                    │    (relevance-filtered)     │
                    │  • user OCEAN profile       │
                    │  • narrative summary        │
                    │                             │
                    │  Output: memory_context     │
                    └──────────┬──────────┬───────┘
                               │          │
               ┌───────────────┘          └──────────────────┐
               │  Realtime                                   │  Background async
               ▼                                             ▼
┌──────────────────────────┐               ┌──────────────────────────────┐
│     Knowledge Agent       │              │       Inference Agent        │
│     knowledge.py          │              │       inference.py           │
│                           │              │                              │
│  ChromaDB vector search   │              │  Reads from Neo4j:           │
│  embed: text-embedding    │              │  • OCEAN current scores      │
│         -3-small          │              │  • conversation history      │
│                           │              │                              │
│  Output: rag_examples     │              │  GPT-4o-mini analyzes        │
│          (top-k chunks)   │              │  → updates scores via EMA    │
└──────────┬────────────────┘              │    O C E A N (α=0.15)       │
           │                               │                              │
           │                               │  Writes back → Neo4j         │
           │                               └──────────────────────────────┘
           │                                             │
           │                               ┌────────────▼─────────────────┐
           │                               │    Narrative Reflection      │
           │                               │    (triggers every 10 turns) │
           │                               │                              │
           │                               │  Summarizes conversation     │
           │                               │  → generates reflection note │
           │                               │  → saves to Neo4j            │
           │                               └──────────────────────────────┘
           │
           │         ┌─────────────────────────────────────┐
           │         │           prompts.py                │
           │         │   (system prompts for all agents)   │
           │         └──────────────────┬──────────────────┘
           │                            │
           ▼                            ▼
┌──────────────────────────────────────────────────────────┐
│                    Dialogue Agent                        │
│                    dialogue.py                           │
│                                                          │
│  Combined input:                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   emotion   │  │    memory    │  │   rag_examples  │  │
│  │   label +   │  │   context    │  │   (ChromaDB)    │  │
│  │   score     │  │   (Neo4j)    │  │                 │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
│            ↓               ↓                  ↓          │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              GPT-4o-mini (temperature=0)              │ │
│  │   system prompt (from prompts.py)                     │ │
│  │   + OCEAN profile (from Inference Agent)              │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │      Final Response     │
              └────────────┬────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
┌───────────────────┐         ┌───────────────────────┐
│  mode: messaging  │         │     mode: voice       │
│                   │         │                       │
│  Text response    │         │  User audio           │
│  → send directly  │         │  → Whisper STT        │
│    via WebSocket  │         │  → Text (processed    │
│                   │         │    normally as above) │
│                   │         │  → ElevenLabs TTS     │
│                   │         │  → Audio response     │
│                   │         │    via WebSocket      │
└───────────────────┘         └───────────────────────┘


╔══════════════════════════════════════════════════════════╗
║         Empty Chair Agent  (runs independently)          ║
║         emptychair_agent.py                              ║
║                                                          ║
║  Trigger: mode = empty-chair                             ║
║  Does NOT go through Router → Dialogue pipeline          ║
║                                                          ║
║  Input:                                                  ║
║  • relationship_context (provided by user)               ║
║  • target_person_profile                                 ║
║  • conflict_history (from Graph Memory)                  ║
║  • dedicated system prompt (Gestalt therapy)             ║
║                                                          ║
║  GPT-4o-mini (temperature=0.7) role-plays as target      ║
║  → Simulates that person's responses                     ║
║  → Supports empty chair therapy technique                ║
║                                                          ║
║  Output → WebSocket → Frontend (empty-chair/page.tsx)    ║
╚══════════════════════════════════════════════════════════╝
```

### Các Agent

| Agent | File | Vai trò |
|-------|------|---------|
| **Perception Agent** | `perception.py` | Phân tích cảm xúc (keyword + RoBERTa) |
| **Router Agent** | `router.py` | Định tuyến pipeline: chọn RAG ± Memory/OCEAN cho mỗi tin nhắn |
| **Inference Agent** | `inference.py` | Suy luận tính cách OCEAN, cập nhật qua EMA smoothing |
| **Knowledge Agent** | `knowledge.py` | Truy xuất ví dụ thấu cảm qua RAG (ChromaDB) |
| **Dialogue Agent** | `dialogue.py` | Tổng hợp context & sinh phản hồi thấu cảm |
| **Empty Chair Agent** | `emptychair_agent.py` | Đóng vai đối tượng trong liệu pháp Gestalt |

---

## 🛠️ Tech Stack

| Thành phần       | Công nghệ                                        |
| ---------------- | ------------------------------------------------- |
| Backend          | Python 3.12+, FastAPI (REST + WebSocket)          |
| Frontend         | Next.js 16, React 19, TypeScript, Tailwind CSS 4  |
| Package Manager  | `uv` (backend), `npm` (frontend)                  |
| LLM              | GPT-4o-mini (dialogue, inference, routing)         |
| Emotion Detection| RoBERTa (`SamLowe/roberta-base-go_emotions`)      |
| Graph DB         | Neo4j (Memory, OCEAN Profile, Narrative)           |
| Vector DB        | ChromaDB (RAG — ESConv + EPITOME dataset)          |
| Voice STT        | OpenAI Whisper                                     |
| Voice TTS        | ElevenLabs                                         |
| UI               | Framer Motion, Recharts (OCEAN radar chart)        |

---

## ⚙️ Cài Đặt & Khởi Chạy

### Yêu cầu

- [Python 3.12+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/)
- [uv](https://docs.astral.sh/uv/)
- Neo4j server (Local hoặc [AuraDB](https://neo4j.com/cloud/platform/aura-graph-database/))

### 1. Clone & cài đặt dependencies

```bash
git clone https://github.com/BaoWhiteHat/agentic-empathy-ai.git
cd agentic-empathy-ai

# Backend
cd backend && uv sync

# Frontend
cd ../frontend && npm install
```

### 2. Cấu hình môi trường

Tạo file `backend/.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
ELEVEN_API_KEY=your_elevenlabs_api_key
```

> ⚠️ **Không commit file `.env`** — đã được thêm vào `.gitignore`.

### 3. Build RAG Knowledge Base

ChromaDB phải được build trước khi chạy app. KnowledgeAgent yêu cầu `chroma_db/` đã có dữ liệu.

```bash
cd backend

# Option A: ESConv dataset only (80% train split)
uv run python scripts/build_rag_from_esconv.py

# Option B: ESConv 100% + EPITOME level=2 (khuyến nghị)
uv run python scripts/build_rag_combined.py
```

### 4. Khởi động

```bash
# Terminal 1 — Backend (port 8000)
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (port 3000)
cd frontend
npm run dev
```

### 5. Kiểm tra hệ thống

```bash
cd backend && uv run python audit_pipeline.py
```

Validates: env vars, agent connectivity, Neo4j, ChromaDB, prompts.

---

## 📡 API Reference

| Endpoint                          | Mô tả                              |
| --------------------------------- | ---------------------------------- |
| `GET /docs`                       | Swagger UI – tài liệu REST API     |
| `WS /ws/chat/{user_id}`          | WebSocket – kết nối chat real-time  |
| `GET /profile/ocean/{user_id}`   | OCEAN personality scores (JSON)     |

### WebSocket Message Protocol

**Client → Server:**
```json
{"action": "send_text", "mode": "messaging|voice|empty-chair", "text": "...", "use_voice": false}
{"action": "start_recording", "mode": "voice"}
```

**Server → Client:**
```json
{"type": "message", "content": "...", "mode": "..."}
{"type": "emotion_status", "emotion": "...", "confidence": 0.85}
{"type": "status", "content": "listening|speaking|idle"}
{"type": "user_speech", "content": "..."}
```

Empty-chair sessions khởi tạo bằng format đặc biệt:
```
[SYSTEM_INIT] TARGET: {name} | RELATIONSHIP: {relation} | UNSPOKEN_NEED: {need} | MESSAGE: {message}
```

---

## 📁 Cấu Trúc Thư Mục

```
agentic-empathy-ai/
├── backend/
│   ├── agent/              # Các agent chuyên biệt
│   │   ├── perception.py   #   Emotion detection (RoBERTa + keywords)
│   │   ├── router.py       #   Agentic pipeline routing
│   │   ├── memory.py       #   Neo4j graph memory (EMA + narrative)
│   │   ├── knowledge.py    #   RAG retrieval (ChromaDB)
│   │   ├── dialogue.py     #   Response generation
│   │   ├── inference.py    #   OCEAN personality inference
│   │   ├── emptychair_agent.py  # Empty chair therapy
│   │   ├── voice_io.py     #   STT/TTS interface
│   │   └── prompts.py      #   All system prompts (centralized)
│   ├── api/                # REST & WebSocket endpoints
│   ├── core/               # Engine orchestrator & DI
│   ├── data/               # Emotion keywords, datasets
│   ├── evaluate/           # Benchmark & evaluation scripts
│   ├── scripts/            # RAG build scripts
│   └── main.py             # Entry point
├── frontend/
│   ├── app/                # Next.js App Router pages
│   │   ├── messaging/      #   Text chat
│   │   ├── voice/          #   Voice orb UI
│   │   └── empty-chair/    #   Therapy setup + chat
│   ├── components/         # Sidebar, OceanChart, etc.
│   ├── hooks/useChat.ts    # WebSocket connection hook
│   └── context/            # UserContext, ThemeContext
├── pyproject.toml
└── uv.lock
```

---

## 📊 Evaluation (EPITOME Benchmark)

Ablation study đánh giá chất lượng thấu cảm của từng cấu hình pipeline, sử dụng framework EPITOME từ `behavioral-data/Empathy-Mental-Health`. Đo trên 3 chiều thấu cảm (mỗi chiều 0–2):

| Chiều | Ý nghĩa |
|-------|---------|
| **ER** (Emotional Reactions) | Phản hồi cảm xúc — thể hiện sự đồng cảm với cảm xúc người dùng |
| **IP** (Interpretations) | Diễn giải — nhận diện và diễn đạt lại vấn đề của người dùng |
| **EX** (Explorations) | Khám phá — đặt câu hỏi để hiểu sâu hơn tình huống |

### Quy trình benchmark (7 bước)

1. **Dọn dẹp Neo4j** — Xóa tất cả user `bench*` để đảm bảo clean state
2. **Human baseline** — Tính điểm trung bình ER/IP/EX từ phản hồi thật của Reddit (dataset `data/epitome/`)
3. **Load test data** — 50 seeker posts từ EPITOME (seed=42)
4. **Warm-up** — Gửi 5 tin nhắn cho mỗi benchmark user (`bench_ragmem`, `bench_ragocean`, `bench_agentic`) để xây dựng lịch sử hội thoại + OCEAN profile trước khi test
5. **Sinh phản hồi** — Mỗi post được xử lý qua 5 cấu hình:
   - **Baseline**: GPT-4o-mini thuần (không qua SoulMate pipeline)
   - **RAG**: SoulMate chỉ dùng KnowledgeAgent (ChromaDB)
   - **RAG+Memory**: KnowledgeAgent + GraphMemory
   - **RAG+OCEAN**: KnowledgeAgent + OCEAN personality
   - **Agentic**: RouterAgent tự chọn Memory/OCEAN cho mỗi tin nhắn
6. **Chấm điểm** — Mỗi cặp (seeker_post, response) được chấm bởi 3 model EPITOME (bi-encoder RoBERTa + cross-attention, pre-trained weights: `reddit_ER.pth`, `reddit_IP.pth`, `reddit_EX.pth`)
7. **Tổng hợp** — Tính điểm trung bình → bảng CSV + biểu đồ bar chart + phân tích quyết định của RouterAgent

### Chạy benchmark

```bash
cd backend

# Ablation study đầy đủ (5 configs × 50 posts = 250 responses)
uv run python evaluate/benchmark/run_benchmark_v5.py

# Stability test (chạy 3 lần để kiểm tra tính ổn định)
uv run python evaluate/benchmark/run_stability_test.py
```

### Kết quả chính

- **RAG** là component quan trọng nhất, đóng góp nhiều nhất vào chất lượng thấu cảm
- Stacking cả 3 component (RAG + Memory + OCEAN) gây **context overload** → giảm chất lượng
- **RouterAgent** giải quyết bằng cách chỉ chọn tối đa 1 secondary component (Memory HOẶC OCEAN) trên nền RAG

---

## 📄 License

MIT © 2025 Lê Quốc Bảo – UIT
