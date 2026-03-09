# SoulMate - Agentic AI Companion 🤖

SoulMate là một hệ thống Trợ lý AI (Agentic AI Companion) được thiết kế chuyên biệt để cung cấp sự hỗ trợ về mặt cảm xúc và đồng hành cùng người dùng. Khác với các chatbot phản xạ thông thường, SoulMate được xây dựng dựa trên kiến trúc Multi-Agent hiện đại, có khả năng nhận thức, suy luận logic, duy trì trí nhớ dài hạn (Long-term Memory) qua đồ thị và tương tác đa phương thức (văn bản & giọng nói).

Dự án được phát triển bởi **Lê Quốc Bảo** - Sinh viên Trường Đại học Công nghệ Thông tin (UIT).

## 🚀 Các Tính Năng Cốt Lõi

* **Kiến trúc Multi-Agent:** Hệ thống được chia thành nhiều Agent chuyên biệt phối hợp nhịp nhàng với nhau:
  * `Perception Agent`: Nhận diện bối cảnh và cảm xúc đầu vào.
  * `Inference Agent`: Suy luận đặc điểm tính cách và cập nhật hồ sơ người dùng.
  * `Knowledge Agent`: Truy xuất dữ liệu (RAG) và ví dụ hội thoại.
  * `Dialogue Agent`: Tổng hợp thông tin và sinh phản hồi tự nhiên, thấu cảm.
  * `Empty Chair Agent`: Đóng vai một đối tượng giả định để người dùng thực hành liệu pháp tâm lý "Chiếc ghế trống" (Empty Chair Therapy).
* **Graph Memory (Neo4j):** Lưu trữ và theo dõi sự thay đổi về hồ sơ tâm lý (chuẩn OCEAN) cũng như lịch sử cốt truyện của người dùng theo thời gian thực.
* **Giao tiếp Real-time:** Hỗ trợ luồng chat liên tục, độ trễ thấp thông qua WebSockets.
* **Voice I/O:** Tích hợp module xử lý giọng nói (Speech-to-Text & Text-to-Speech) cho trải nghiệm giao tiếp rảnh tay.

## 🛠️ Công Nghệ & Kiến Trúc

* **Ngôn ngữ:** Python 3.12+
* **Backend Framework:** FastAPI (REST API & WebSockets)
* **Quản lý Môi trường & Package:** `uv` (Nhanh và đồng bộ)
* **Cơ sở dữ liệu:** * Neo4j (Graph Database cho Memory & Profile)
  * ChromaDB (Vector Database cho Knowledge & RAG)

## ⚙️ Hướng Dẫn Cài Đặt & Khởi Chạy (Backend)

Dự án sử dụng công cụ `uv` để quản lý môi trường ảo và dependencies một cách tối ưu nhất.

### 1. Yêu cầu hệ thống
* Đã cài đặt [Python 3.12+](https://www.python.org/downloads/)
* Đã cài đặt [uv](https://docs.astral.sh/uv/)
* Có sẵn server Neo4j đang chạy (Local hoặc AuraDB)

### 2. Cài đặt thư viện
Tại thư mục gốc của dự án, chạy lệnh sau để `uv` tự động đồng bộ toàn bộ thư viện cần thiết từ file `uv.lock`:
```bash
uv sync
3. Cấu hình biến môi trường
Tạo một file .env tại thư mục gốc và cung cấp các thông tin xác thực sau:

Đoạn mã
OPENAI_API_KEY=your_openai_api_key_here
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
4. Khởi động Máy chủ Uvicorn
Di chuyển vào thư mục backend và chạy lệnh sau để kích hoạt API:

Bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
Server sẽ được khởi động tại: http://localhost:8000

5. API Endpoints Chính
Tài liệu REST API (Swagger UI): http://localhost:8000/docs

Cổng kết nối WebSocket Chat: ws://localhost:8000/ws/chat/{user_id}