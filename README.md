# Cuộc Đua 12 Con Giáp

Game đua tranh thời gian thực 2v2, nơi 4 người chơi chia thành 2 đội thi nhau chiếm ô trên bàn cờ thiên giới. Đội đầu tiên chiếm được 10 ô sẽ giành chiến thắng.

## Cấu trúc dự án

```
NT208-Project/
├── client/          # Next.js 14 frontend (port 3000)
├── server/
│   ├── api/         # Express REST API + Prisma + PostgreSQL (port 4000)
│   └── game/        # Express + Socket.IO game server (port 3001)
├── shared/          # Shared TypeScript types
└── docker-compose.yml
```

## Khởi chạy

```bash
npm install
npm run db:up        # Khởi động PostgreSQL + Redis (Docker)
npm run db:migrate   # Áp dụng Prisma migrations
npm run db:seed      # Tạo tài khoản admin
npm run dev          # Chạy tất cả services
```

Ports mặc định:
- **Client**: `3000`
- **Game server**: `3001`
- **API server**: `4000`
- **PostgreSQL**: `25432`
- **Redis**: `26379`

## Các lệnh hữu ích

| Lệnh | Mô tả |
|---|---|
| `npm run db:up` | Khởi động Postgres + Redis |
| `npm run db:down` | Dừng Postgres + Redis |
| `npm run db:restart` | Khởi động lại nếu port bị kẹt |
| `npm run db:migrate` | Áp dụng migrations |
| `npm run db:seed` | Tạo/cập nhật tài khoản admin |
| `npm run db:studio` | Mở Prisma Studio |
| `npm run dev` | Chạy toàn bộ dự án |

## Biến môi trường

Sao chép `server/api/.env.example` thành `server/api/.env` trước khi migrate.

**API Server (`server/api/.env`):**
```
DATABASE_URL="postgresql://zodiac_user:zodiac_password@localhost:25432/zodiac_game?schema=public"
REDIS_URL="redis://localhost:26379"
JWT_SECRET="dev_jwt_secret_change_me"
JWT_EXPIRES_IN="7d"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
FRONTEND_ORIGINS="http://localhost:3000"
GAME_SERVER_INTERNAL_SECRET="dev_internal_secret_change_me"
```

**Game Server (`server/game/.env`):**
```
API_BASE_URL="http://localhost:4000"
GAME_SERVER_INTERNAL_SECRET="dev_internal_secret_change_me"
```

**Client (`client/.env.local`):**
```
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
NEXT_PUBLIC_GAME_SOCKET_URL="http://localhost:3001"
```

## Tính năng

### Xác thực & Hồ sơ
- Đăng ký / đăng nhập bằng JWT
- Hồ sơ người dùng với avatar tùy chỉnh, level, ELO
- Hệ thống rank: Beginner → Silver → Gold → Platinum → Diamond → Mythic
- Trang cá nhân với thống kê trận đấu

### Gameplay — Cuộc Đua 12 Con Giáp
- **Bàn cờ**: 9×7 ô — 20 ô Thiên Can, 13 ô Rút Bài, 30 ô Trắng
- **4 người chơi** chia thành **2 đội 2 người**, thắng khi chiếm đủ 10 ô
- **Thứ tự lượt**: Đội1-P1 → Đội2-P1 → Đội1-P2 → Đội2-P2
- **Cơ chế Sợi Dây Thiên Cơ**: hai đồng đội bị giới hạn khoảng cách tối đa, buộc phải phối hợp
- **Bài đặc biệt**: Dịch chuyển đối xứng, Teleport góc, Teleport Thiên Can, Đổi vị trí đồng đội...
- **Hồi sinh**: bị kẹt → mất tối đa 3 ô đã chiếm, hồi sinh gần đồng đội

### Thẻ & Bộ bài
- 24 lá bài trong pool: 12 bài Di Chuyển + 12 bài Đặc Biệt
- Rút bài mỗi lượt, chơi hoặc bỏ qua

### Matchmaking
- **Quick Join**: tự động ghép 4 người lạ
- **Party Mode**: tạo phòng riêng, mời bạn bè cùng chơi

### Cửa hàng (Shop)
- Mua skin, vật phẩm bằng Coins hoặc Gems
- Trang phục avatar & khung ảnh đại diện
- Admin panel để quản lý sản phẩm (`/admin/shop`)

### Bạn bè & Chat
- Gửi/chấp nhận lời mời kết bạn
- Nhắn tin trực tiếp với bạn bè
- Xem trạng thái online

### Bảng xếp hạng (BXH)
- Xếp hạng người chơi theo ELO
- Hiển thị tier, level, số trận thắng/thua

### Cốt Truyện (Stories)
- 9 chương truyện kể về hành trình **Đại Hội Lập Pháp** của 12 con giáp
- Chương X mở khóa khi đạt **Level X**
- Giao diện cuộn giấy cổ điển lấy từ thiết kế Figma
- Thông báo tự động khi lên cấp và có chương mới được mở khóa

### Hệ thống phần thưởng
| | Coins | Gems | ELO |
|---|---|---|---|
| **Thắng** | +10 | +1 | +200 |
| **Thua** | +2 | — | +40 |

ELO tích lũy qua các trận đấu, dùng để tính Level và mở khóa cốt truyện.

## Admin

Chạy `npm run db:seed` để tạo tài khoản admin. Người dùng thường không thể tự đăng ký quyền admin.

- Trang admin: `/admin/shop`
- API admin: `GET/POST/PATCH/DELETE /api/admin/shop/items`
- Bật/tắt sản phẩm: `PATCH /api/admin/shop/items/:id/toggle-active`

## Internal API (Game Server → API)

Khi ván đấu kết thúc, game server tự động gọi API để trao thưởng:

```
POST /api/internal/matches/reward
Header: x-game-server-secret: <GAME_SERVER_INTERNAL_SECRET>
```

---

Chúng em đã biết làm web và hiểu hệ thống web hoạt động như thế nào.
