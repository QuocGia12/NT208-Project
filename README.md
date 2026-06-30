# Game Cuộc Đua 12 Con Giáp

**Môn học:** Lập trình Web – NT208.Q21.ANTN  
**Trường:** Đại học Công nghệ Thông tin – ĐHQG TP.HCM
## Thông tin nhóm 
|Họ và Tên|MSSV|Tỷ lệ đóng góp|
|---------|:----:|:--------------:|
|Nguyễn Văn Quốc Gia|24520415|50%|
|Nguyễn Thị Mỹ Duyên|24520408|50%|

**Giảng viên hướng dẫn:** ThS. Trần Tuấn Dũng  

---

## Giới thiệu

**"Cuộc Đua 12 Con Giáp"** là đồ án môn Lập trình Web, xây dựng một trò chơi board game thời gian thực nhiều người chơi theo mô hình 2 đội (2v2). Lấy cảm hứng từ văn hóa 12 con giáp phương Đông, game đặt 4 người chơi vào một bàn cờ thiên giới, nơi mỗi đội phải phối hợp chiến thuật để chiếm đủ 10 ô trước đối thủ.

Dự án xây dựng theo kiến trúc **monorepo full-stack**, với client sử dụng Next.js 14 + Phaser 3 để render game 2D, backend tách biệt thành hai server: một REST API server quản lý người dùng và dữ liệu, và một game server thời gian thực sử dụng Socket.IO. Toàn bộ logic game đặt ở phía server (**authoritative server**), đảm bảo tính công bằng và chống gian lận từ client.

## Các link quan trọng
**1. Deploy:** Trang web đã được deploy trên https://qgiaaa.me

**2. Video demo tính năng:** https://drive.google.com/file/d/1EELH309Q1oUTqM7-9a4uWWD_jjd4IIwj/view?usp=sharing

**3. Video khảo sát user:** https://youtube.com/shorts/vLa3cYvML28?feature=share

**4. Ảnh chụp minh chứng cộng điểm:** https://drive.google.com/drive/folders/1pFW0jp7A0U8wdaUDLvknU4OxjSaoWds4?usp=drive_link 

## Các tính năng mới

### 1. Login Streak — Điểm danh nhận thưởng hàng ngày

Người chơi có thể đăng nhập mỗi ngày để nhận thưởng theo chuỗi liên tiếp (streak). Hệ thống hoạt động theo chu kỳ *12 ngày*, sau đó tự động lặp lại từ đầu.

*Cơ chế hoạt động:*
- Mỗi ngày người chơi chỉ được nhận thưởng *một lần duy nhất* (tính theo múi giờ Việt Nam, UTC+7).
- Nếu người chơi đăng nhập vào ngày hôm sau liên tiếp, chuỗi streak sẽ tăng lên và phần thưởng của ngày tiếp theo được mở khóa.
- Nếu bỏ lỡ một ngày (không đăng nhập hoặc không nhận thưởng vào ngày kế tiếp), chuỗi sẽ *bị reset về ngày 1*.
- Sau khi hoàn thành đủ 12 ngày trong chu kỳ, vòng tiếp theo bắt đầu lại từ ngày 1.

*Bảng phần thưởng theo ngày:*

| Ngày | Phần thưởng |
|------|-------------|
| 1    | 10 xu       |
| 2    | 15 xu       |
| 3    | 20 xu       |
| 4    | 25 xu       |
| 5    | 30 xu       |
| 6    | 10 đá quý  |
| 7    | 35 xu       |
| 8    | 40 xu       |
| 9    | 45 xu       |
| 10   | 50 xu       |
| 11   | 55 xu       |
| 12   | 20 đá quý  |

---

### 2. Stories — Cốt truyện theo chương

Người chơi có thể theo dõi cốt truyện của game thông qua hệ thống *09 chương truyện*, mỗi chương được mở khóa dựa trên level của người chơi.

*Cơ chế hoạt động:*
- Chương X được mở khóa khi người chơi đạt *Level X*.
- Level được tính dựa trên điểm ELO tích lũy qua các trận đấu.
- Các chương bị khóa sẽ hiển thị biểu tượng ổ khóa và thông báo level cần đạt để mở.
- Nội dung từng chương (tiêu đề và văn bản truyện) được tải động từ server, giúp tiết kiệm băng thông — chỉ tải chương đang được chọn.
- Giao diện hiển thị dạng cuộn giấy cổ (scroll panel) với hình nền riêng biệt cho từng chương.


---

### 3. Quản lý cửa hàng bởi Admin

Tài khoản admin có thể thêm và quản lý các vật phẩm mới trong cửa hàng thông qua giao diện quản trị, bao gồm ba loại skin chính:

*Bản đồ mới (Map skin):*
- Admin tải lên file `.zip` chứa toàn bộ hình ảnh cho bản đồ (tối đa 20MB).
- File zip phải bao gồm đủ: `preview.png`, `add-card.png`, và ảnh cho 12 cung hoàng đạo (`ty.png, suu.png, dan.png, mao.png, thin.png, ti.png, ngo.png, mui.png, than.png, dau.png, tuat.png, hoi.png`).
- Hệ thống tự động giải nén, kiểm tra tính hợp lệ và lưu trữ các ảnh, sau đó tạo metadata đầy đủ cho bản đồ.

*Xúc xắc mới (Dice skin):*
- Admin tải lên ảnh xúc xắc tùy chỉnh (PNG/JPEG/WebP/GIF, tối đa 5MB).
- Sau khi upload, ảnh được lưu trữ và gắn vào vật phẩm trong cửa hàng với loại SKIN và `skinType: DICE`.

*Frame mới (Frame skin):*
- Admin tải lên ảnh khung avatar tùy chỉnh (PNG/JPEG/WebP/GIF, tối đa 5MB).
- Frame được đăng bán trong cửa hàng với loại SKIN và `skinType: FRAME`.

*Các thao tác quản lý:*
- Thêm vật phẩm mới với tên, mô tả, giá xu và giá đá quý tùy chỉnh.
- Chỉnh sửa thông tin vật phẩm đã có.
- Bật/tắt trạng thái hiển thị vật phẩm trong cửa hàng.
- Xóa vật phẩm khỏi cửa hàng.

## Kiến trúc hệ thống

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENT (port 3000)                     │
│        Next.js 14 (App Router) + Phaser 3 + Zustand       │
└──────────────────┬────────────────┬──────────────────────┘
                   │  REST / HTTP   │  WebSocket (Socket.IO)
                   ▼                ▼
 ┌─────────────────────────┐  ┌──────────────────────────┐
 │   API Server (4000)     │  │  Game Server (3001)       │
 │   Express + Prisma ORM  │◄─│  Express + Socket.IO      │
 │   PostgreSQL (25432)    │  │  Authoritative game logic  │
 │   Redis      (26379)    │  │  RoomManager, TurnEngine   │
 └─────────────────────────┘  └──────────────────────────┘
```

**Luồng dữ liệu chính:**
- Người chơi xác thực qua API Server (JWT), sau đó kết nối vào Game Server bằng token.
- Mọi hành động game (di chuyển, chơi bài, chiếm ô) gửi lên Game Server và xử lý hoàn toàn server-side.
- Khi ván đấu kết thúc, Game Server gọi nội bộ vào API Server để cập nhật ELO, coins, gems.
- Client chỉ là lớp render — nhận `game:state_update` và hiển thị, không tự giữ state game.

---

## Khởi chạy
1. `npm install`
2. `npm run db:up`
3. `npm run db:migrate`
4. `npm run db:seed`
5. `npm run dev`

Các port mặc định:
- client: port 3000
- game server: port 3001
- api server: port 4000
- postgres: port 25432
- redis: port 26379

Các lệnh hữu ích:
- `npm run db:up`: Khởi động Postgres và Redis
- `npm run db:down`: Dừng Postgres và Redis
- `npm run db:restart`: Khởi động lại Postgres và Redis nếu Docker bị kẹt cổng
- `npm run db:migrate`: Áp dụng các migration của Prisma
- `npm run db:seed`: Tạo hoặc cập nhật tài khoản admin từ `server/api/.env`
- `npm run db:studio`: Mở Prisma Studio
- `npm run dev`: Khởi động DB, game server, API server và frontend cùng lúc

## Cấu hình môi trường
Sao chép hoặc chỉnh sửa `server/api/.env` trước khi chạy migration hoặc seed.

Các biến bắt buộc cho API:
- DATABASE_URL: Chuỗi kết nối PostgreSQL
- JWT_SECRET: Khóa bí mật dùng để ký JWT
- FRONTEND_ORIGINS: Danh sách các origin frontend được phép (phân cách bởi dấu phẩy), ví dụ: `http://localhost:3000`,`https://qgiaaa.me`, `https://www.qgiaaa.me`
- GAME_SERVER_INTERNAL_SECRET: Khóa bí mật dùng để game server trao thưởng trận đấu
- ADMIN_USERNAME: Tên đăng nhập admin khi seed.
- ADMIN_PASSWORD: Mật khẩu admin khi seed.
- ADMIN_AVATAR: URL avatar admin (tùy chọn)

Các biến cho game server:
- API_BASE_URL: URL của API server dùng để trao thưởng trận đấu, mặc định là `http://localhost:4000`
- GAME_SERVER_INTERNAL_SECRET: Phải khớp với giá trị đã cấu hình bên API

Các biến cho client (trong `client/.env.local`):
- NEXT_PUBLIC_API_BASE_URL: URL của API server, mặc định là `http://localhost:4000`
- NEXT_PUBLIC_GAME_SOCKET_URL: URL của game server thời gian thực, mặc định là `http://localhost:3001`
- NEXT_PUBLIC_GAME_SERVER_URL: Biến dự phòng cũ cho cùng URL game server thời gian thực.

> ***Ghi chú: Chúng em đã biết làm web và hiểu hệ thống web hoạt động như thế nào.***
