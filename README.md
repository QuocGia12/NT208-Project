# Cuộc Đua 12 Con Giáp — Đại chiến Quái thú

Digital Board Game | Multiplayer | Turn-based Strategy

## Tech Stack
- **Frontend**: React + Vite + Phaser.js + Socket.io-client
- **Backend**: Node.js + Express + Socket.io
- **Database**: MongoDB + Redis
- **DevOps**: Docker

## Chạy local

### Yêu cầu
- Node.js 20+
- Docker Desktop

### Các bước

1. Clone repo
2. Chạy database: `docker-compose up -d`
3. Chạy server: `cd server && npm install && npm run dev`
4. Chạy client: `cd client && npm install && npm run dev`

## Cấu trúc thư mục
- `client/` — React frontend
- `server/` — Node.js backend
- `shared/` — Constants và types dùng chung

Commit toàn bộ lên GitHub:
git add .
git commit -m "feat: initial project structure setup"
git push origin main

Tạo branch develop:
git checkout -b develop
git push origin develop
