# SoulMate – Agentic AI Companion 🤖💙

> Một người bạn đồng hành AI thấu cảm, được xây dựng trên kiến trúc Multi-Agent với trí nhớ đồ thị và giao tiếp đa phương thức.

Phát triển bởi **Lê Quốc Bảo** — Sinh viên Trường Đại học Công nghệ Thông tin (UIT).

---

## ✨ Tính Năng Nổi Bật

| Tính năng                       | Mô tả                                                                |
| ------------------------------- | -------------------------------------------------------------------- |
| 🧠 **Multi-Agent Architecture** | Nhiều agent chuyên biệt phối hợp để nhận thức, suy luận và phản hồi  |
| 🗂️ **Graph Memory**             | Neo4j lưu hồ sơ tâm lý OCEAN & lịch sử hội thoại theo thời gian thực |
| ⚡ **Real-time WebSocket**      | Chat liên tục, độ trễ thấp                                           |
| 🎙️ **Voice I/O**                | Giao tiếp bằng giọng nói (STT & TTS)                                 |
| 🛋️ **Empty Chair Therapy**      | Agent mô phỏng liệu pháp "Chiếc ghế trống"                           |

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────┐
│                  User Input                  │
│              (Text / Voice)                  │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │  Perception Agent  │  ← Nhận diện cảm xúc & bối cảnh
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │  Inference Agent   │  ← Cập nhật hồ sơ tính cách (OCEAN)
         └─────────┬─────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼───┐    ┌────▼────┐   ┌─────▼──────┐
│ Know- │    │Dialogue │   │Empty Chair │
│ledge  │    │ Agent   │   │   Agent    │
│Agent  │    │         │   │            │
└───────┘    └────┬────┘   └────────────┘
(RAG/ChromaDB)    │
                  ▼
           Final Response
```

### Các Agent

- **Perception Agent** — Phân tích cảm xúc và bối cảnh đầu vào
- **Inference Agent** — Suy luận đặc điểm tính cách, cập nhật hồ sơ OCEAN
- **Knowledge Agent** — Truy xuất tri thức qua RAG (ChromaDB)
- **Dialogue Agent** — Tổng hợp & sinh phản hồi thấu cảm
- **Empty Chair Agent** — Đóng vai đối tượng trong liệu pháp tâm lý

---

## 🛠️ Tech Stack

| Thành phần      | Công nghệ                       |
| --------------- | ------------------------------- |
| Language        | Python 3.12+                    |
| Backend         | FastAPI (REST + WebSocket)      |
| Package Manager | `uv`                            |
| Graph DB        | Neo4j (Memory & User Profile)   |
| Vector DB       | ChromaDB (RAG & Knowledge)      |
| Voice           | Speech-to-Text / Text-to-Speech |

---

## ⚙️ Cài Đặt & Khởi Chạy

### Yêu cầu

- [Python 3.12+](https://www.python.org/downloads/)
- [uv](https://docs.astral.sh/uv/)
- Neo4j server (Local hoặc [AuraDB](https://neo4j.com/cloud/platform/aura-graph-database/))

### 1. Clone & cài đặt dependencies

```bash
git clone https://github.com/BaoWhiteHat/agentic-empathy-ai.git
cd agentic-empathy-ai
uv sync
```

### 2. Cấu hình môi trường

Tạo file `.env` tại thư mục gốc:

```env
OPENAI_API_KEY=your_openai_api_key_here
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
```

> ⚠️ **Không commit file `.env`** — đã được thêm vào `.gitignore`.

### 3. Khởi động server

```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server chạy tại: **http://localhost:8000**

---

## 📡 API Reference

| Endpoint                | Mô tả                              |
| ----------------------- | ---------------------------------- |
| `GET /docs`             | Swagger UI – tài liệu REST API     |
| `WS /ws/chat/{user_id}` | WebSocket – kết nối chat real-time |

---

## 📁 Cấu Trúc Thư Mục

```
agentic-empathy-ai/
├── backend/
│   ├── agent/          # Các agent chuyên biệt
│   ├── api/            # REST API endpoints
│   ├── core/           # Engine & dependencies
│   ├── data/           # Dữ liệu & benchmarks
│   ├── evaluate/       # Evaluation scripts
│   └── main.py         # Entry point
├── pyproject.toml
└── uv.lock
```

---

## 📄 License

MIT © 2025 Lê Quốc Bảo – UIT
