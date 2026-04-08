# Cuộc Đua 12 Con Giáp — Đại chiến Quái thú

Digital Board Game | Multiplayer | Turn-based | Realtime (Socket.io)

## Trạng thái hiện tại (08/04/2026)

Game đã chơi được end-to-end (vào phòng → start game → lượt → di chuyển → nhặt lương thực → quái thú → kết thúc ván).

Lưu ý: cơ chế **effects (lá bài / kỹ năng nhân vật / stack interrupt)** vẫn đang trong quá trình ổn định và có thể chưa đúng như thiết kế.

## Tính năng đã hoạt động

- Multiplayer theo phòng (Socket.io) + sync state
- Turn-based flow: bắt đầu lượt, đổ xúc xắc, chọn ô hợp lệ để di chuyển, kết thúc lượt
- Board render bằng Phaser + animate di chuyển
- Shop/food:
	- Player chỉ nhặt lương thực khi **đặt chân đến shop** (shop -1, player +1)
	- Quái thú phá shop cuối round: shop bị phá hủy và player đứng trên đó bị -1 food (nếu có)
- Giới hạn bài trên tay: > 6 lá thì người chơi đó phải bỏ bài (hiện đúng cho đúng người)
- Kết thúc ván khi:
	- Toàn bộ food đã được thu thập, hoặc
	- Quái thú phá hủy toàn bộ shop
- Kết quả ván:
	- Có xử lý trường hợp hòa (chia thưởng theo nhóm có cùng food)

## Chưa ổn / Known issues

- Effects của **lá bài (-)** và **stack window / interrupt bằng lá (+)**: logic effect / thứ tự resolve / điều kiện dùng có thể chưa đúng hoàn toàn.
- Timing (+) hiện ưu tiên dùng như interrupt khi stack đang mở; cần thêm rule/UX rõ ràng để tránh hiểu nhầm “lúc nào cũng dùng được”.
- Một số đoạn "broadcast riêng" vẫn đang dùng broadcast cả phòng kèm `targetUserId` (client tự lọc); về sau nên map `userId → socketId` để gửi riêng đúng nghĩa.

## Tech Stack

- Frontend: React + Vite + Phaser.js + socket.io-client
- Backend: Node.js + Express + socket.io
- Data: MongoDB + Redis
- Dev: Docker Compose

## Chạy local

### Yêu cầu

- Node.js 20+
- Docker Desktop

### Bước chạy nhanh

1) Chạy DB + Redis:

```bash
docker-compose up -d
```

2) Chạy server:

```bash
cd server
npm install
npm run dev
```

3) (Tuỳ chọn) Seed dữ liệu cards/characters:

```bash
cd server
npm run seed
```

4) Chạy client:

```bash
cd client
npm install
npm run dev
```

### Trang test

- `test-socket.html`: test kết nối socket
- `test-game.html`: test nhanh game loop

## Cấu trúc thư mục

- `client/` — React frontend (UI + Phaser)
- `server/` — Node.js backend (game engine + socket handlers)
- `shared/` — constants/types dùng chung
