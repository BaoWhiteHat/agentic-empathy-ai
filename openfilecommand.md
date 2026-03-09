# 🗂️ Git Workflow – SoulMate Project

> Cheat sheet cho quy trình làm việc chuẩn. Làm theo đúng thứ tự này mỗi lần thêm tính năng mới!

---

## 🟢 Bước 1 — Khởi động hệ thống (Mở 2 Terminal)

**Terminal 1 – Backend:**

```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 – Frontend:**

```bash
cd frontend
npm run dev
```

> ✅ Backend chạy tại: http://localhost:8000  
> ✅ Frontend chạy tại: http://localhost:3000

---

## 🟡 Bước 2 — Tạo nhánh mới cho tính năng

```bash
git checkout main
git pull origin main
git checkout -b feat/ten-tinh-nang
```

**Ví dụ tên nhánh hay dùng:**

| Loại           | Tên nhánh                  |
| -------------- | -------------------------- |
| Tính năng mới  | `feat/sidebar-ocean-chart` |
| Sửa bug        | `fix/websocket-disconnect` |
| Cải thiện code | `refactor/inference-agent` |
| Tài liệu       | `docs/update-readme`       |

---

## 🟠 Bước 3 — Code, Save & Commit

```bash
# 1. Kiểm tra file nào đã thay đổi
git status

# 2. Thêm file vào staging (chọn 1 trong 2 cách)
git add frontend/components/Sidebar.tsx   # Thêm 1 file cụ thể
git add .                                  # Thêm tất cả file đã sửa

# 3. Commit với message rõ ràng
git commit -m "feat: thêm Sidebar và tích hợp biểu đồ OCEAN"
```

**Chuẩn viết commit message:**

| Prefix      | Dùng khi nào                         |
| ----------- | ------------------------------------ |
| `feat:`     | Thêm tính năng mới                   |
| `fix:`      | Sửa bug                              |
| `refactor:` | Cải thiện code, không thêm tính năng |
| `docs:`     | Cập nhật tài liệu / README           |
| `chore:`    | Cập nhật config, dependencies        |

---

## 🔵 Bước 4 — Push lên GitHub & Merge

```bash
# 1. Đẩy nhánh lên GitHub
git push origin feat/ten-tinh-nang

# 2. Lên GitHub → "Compare & pull request" → "Create Pull Request" → "Merge"

# 3. Cập nhật lại máy local sau khi merge
git checkout main
git pull origin main
git branch -d feat/ten-tinh-nang   # Xóa nhánh cũ cho gọn
```

---

## 🔴 Xử Lý Tình Huống Khẩn Cấp

### Lỡ commit nhầm file (chưa push)

```bash
git reset --soft HEAD~1   # Hoàn tác commit, giữ lại code
```

### Muốn bỏ thay đổi ở 1 file (chưa commit)

```bash
git checkout -- ten-file.tsx
```

### Conflict khi pull

```bash
git pull origin main
# Mở file conflict, sửa tay phần bị đánh dấu <<<< ==== >>>>
git add .
git commit -m "fix: resolve merge conflict"
```

### Lỡ commit file .env chứa API key

```bash
# 1. Revoke key cũ trên OpenAI ngay lập tức!
# 2. Xóa .env khỏi toàn bộ history
git filter-repo --path .env --invert-paths --force
git remote add origin https://github.com/BaoWhiteHat/agentic-empathy-ai.git
git push origin --force --all
```

---

## 📋 Checklist Trước Khi Push

- [ ] Đã chạy thử backend và frontend, không có lỗi
- [ ] Không commit file `.env`
- [ ] Commit message rõ ràng, đúng prefix
- [ ] Đang ở đúng nhánh `feat/...`, không phải `main`

---

_SoulMate – Lê Quốc Bảo @ UIT_
