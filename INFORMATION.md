# INFORMATION.md - Technical Map for Logic Game 2

Tài liệu này mô tả repo merged hiện tại trong folder `Logic_game2_formatted`.
Mục tiêu là giúp developer/teammate/devops hiểu nhanh hệ thống đang chạy như thế nào, traffic đi qua đâu, mỗi phần dùng công nghệ gì, và những điểm dễ lỗi khi phát triển hoặc deploy.

## 1. Tổng Quan Repo

Repo hiện được format thành 4 phần chính:

```text
Logic_game2_formatted/
  client/       Next.js frontend, UI chính, lobby, shop, admin, matchmaking, Phaser game route
  server/api/   Backend account/auth/social/shop/admin/reward API
  server/game/  Realtime game server, matchmaking, party, room, authoritative game state
  shared/       Shared TypeScript contracts/types
```

Root project là npm workspace:

```json
{
  "workspaces": [
    "client",
    "server/api",
    "server/game",
    "shared"
  ]
}
```

Các port mặc định local:

```text
client Next.js:       http://localhost:3000
game Socket.IO:       http://localhost:3001
api HTTP + Socket.IO: http://localhost:4000
PostgreSQL:           localhost:25432
Redis:                localhost:26379
```

Lưu ý quan trọng: `server/api` và `server/game` là hai backend khác nhau. Frontend gọi cả hai.

## 2. Kiến Trúc Web Và Luồng Traffic

### 2.1. Sơ Đồ Tổng Quát

```text
                         ┌──────────────────────────┐
                         │ Browser / Mobile Browser │
                         └────────────┬─────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
                ▼                     ▼                     ▼
      ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
      │ Next.js Client  │   │ API Server        │   │ Game Server       │
      │ client:3000     │   │ server/api:4000   │   │ server/game:3001  │
      │ www/qgiaaa.me   │   │ api.qgiaaa.me     │   │ game.qgiaaa.me    │
      └────────┬────────┘   └─────────┬────────┘   └─────────┬────────┘
               │                      │                      │
               │ HTTP fetch           │ Prisma               │ Socket.IO
               │ auth/shop/friends    ▼                      │ matchmaking/gameplay
               │             ┌──────────────────┐            │
               │             │ PostgreSQL        │            │
               │             │ user/shop/social  │            │
               │             └──────────────────┘            │
               │                                             │
               │             ┌──────────────────┐            │
               └────────────►│ Static uploads   │◄───────────┘
                             │ /uploads/shop     │
                             └──────────────────┘

                         Game end reward flow:
      ┌──────────────────┐      HTTP internal secret       ┌──────────────────┐
      │ Game Server      │ ──────────────────────────────► │ API Server       │
      │ server/game      │ POST /api/internal/matches/reward│ server/api       │
      └──────────────────┘                                 └──────────────────┘
```

### 2.2. Production Domain Mapping Khuyến Nghị

```text
https://qgiaaa.me hoặc https://www.qgiaaa.me
  -> Nginx reverse proxy tới Next client port 3000

https://api.qgiaaa.me
  -> Nginx reverse proxy tới API server port 4000

https://game.qgiaaa.me
  -> Nginx reverse proxy tới game server port 3001
  -> bắt buộc hỗ trợ WebSocket upgrade cho Socket.IO
```

Nginx cho `game.qgiaaa.me` cần các header WebSocket:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

Nếu thiếu WebSocket upgrade, frontend thường báo `websocket error`, `connect_error`, hoặc tạo phòng không nhận được event.

### 2.3. Luồng Login/Register

```text
1. Browser mở /login hoặc /register từ Next client.
2. Client gọi API:
   POST /api/auth/login
   POST /api/auth/register
3. API validate username/password.
4. API đọc/ghi User trong PostgreSQL bằng Prisma.
5. API trả safe user + JWT.
6. Client lưu auth vào auth store/localStorage.
7. AuthenticatedShell render lobby/HUD/menu.
```

File liên quan:

```text
client/lib/api/auth.ts
client/store/auth-store.ts
client/app/login/page.tsx
client/app/register/page.tsx
server/api/src/routes/auth.routes.ts
server/api/src/utils/safe-user.ts
server/api/src/middleware/auth.middleware.ts
server/api/prisma/schema.prisma
```

Safe user hiện có các thông tin quan trọng:

```text
id, username, avatar, role, elo, coins, gems,
equippedFrameItemId, equippedFrameImageUrl
```

### 2.4. Luồng Authenticated UI

Sau khi login:

```text
Browser -> Next client route group /(authenticated)
        -> AuthenticatedShell
        -> lobby/shop/friends/chat/leaderboard/settings/admin/game
```

Các trang chính:

```text
/lobby
/matchmaking
/matchmaking/party-2
/matchmaking/party-4
/shop
/friends
/chat
/leaderboard
/admin/shop
/game/[roomId]
```

`AuthenticatedShell` là shell chính của UI:

```text
client/components/app/authenticated-shell.tsx
```

Shell chịu trách nhiệm:

```text
- render background/frame/HUD/menu
- hiển thị coin/gem/user/level
- mở settings modal
- phát lobby music
- điều hướng các page authenticated
- bỏ shell hoặc render fullscreen cho route game/matchmaking khi cần
```

### 2.5. Luồng Matchmaking Quick Queue

```text
1. User vào /matchmaking.
2. Client connect tới game server qua Socket.IO.
3. User bấm Bắt đầu ngay.
4. Client emit:
   matchmaking:quick_join
5. Game server đưa player vào solo queue.
6. Khi đủ 4 solo:
   - server random 4 người
   - chia team1/team2 2v2
   - tạo GameRoom
   - gọi startGameWithTeams
   - emit match:found cho từng socket
7. Client nhận match:found:
   - lưu roomId, players, yourPlayerId vào gameSocketClient + localStorage
   - router.push(`/game/${roomId}`)
8. Route /game/[roomId] render Phaser fullscreen.
```

File liên quan:

```text
client/components/matchmaking/matchmaking-flow.tsx
client/lib/game-socket-client.ts
server/game/src/socket/SocketHandler.ts
server/game/src/matchmaking/MatchmakingManager.ts
server/game/src/game/RoomManager.ts
server/game/src/game/GameRoom.ts
server/game/src/game/GameState.ts
```

### 2.6. Luồng Party 2

```text
1. Player A tạo phòng 2.
   Client emit party:create { mode: "party2", player }
2. Server tạo party code uppercase 4 hoặc 6 ký tự.
3. Player B nhập code.
   Client emit party:join { code, player }
4. Hai người nằm cùng team.
5. Cả 2 ready.
6. Server đưa party2 vào queue.
7. Server ghép party2 với:
   - party2 khác
   - hoặc 2 solo queue
8. Server tạo game room và emit match:found.
```

Điểm quan trọng:

```text
- Party 2 có 2 slot cùng team.
- Người trong cùng party2 luôn cùng team.
- Hiện flow đã chuyển sang 2 người ready thì tự queue, không cần button tìm đối thủ.
```

### 2.7. Luồng Party 4

```text
1. Player tạo phòng 4.
2. Server tạo 4 slot cố định:
   team1-slot0
   team1-slot1
   team2-slot0
   team2-slot1
3. Player join bằng code.
4. Người chơi có thể switch sang slot trống.
5. Slot có người không click/switch được.
6. Khi đủ 4 người và tất cả ready:
   - server tạo match ngay
   - không cần queue
   - không cần host bấm start
7. Server emit match:found cho cả 4 người.
```

Turn order gameplay vẫn là:

```text
team1-slot0 -> team2-slot0 -> team1-slot1 -> team2-slot1
```

Lưu ý UI player panel hiện có thể render theo thứ tự team:

```text
team1-slot0
team1-slot1
team2-slot0
team2-slot1
```

Nhưng turn order authoritative vẫn do server core quyết định.

### 2.8. Luồng Vào Game Fullscreen

```text
1. Client nhận match:found.
2. gameSocketClient.rememberMatch(match) lưu:
   - roomId
   - players
   - yourPlayerId
3. Client route tới /game/[roomId].
4. PhaserRoomShell đọc roomId từ route.
5. PhaserRoomShell tìm match context từ:
   - memory gameSocketClient.currentMatch
   - localStorage zodiac:last-match-found
   - fallback user.id nếu thiếu context
6. Client connect game server.
7. PhaserGame mount Phaser canvas.
8. Phaser scenes dùng SocketClient để request state và gửi action.
```

File quan trọng:

```text
client/app/(authenticated)/game/[roomId]/page.tsx
client/components/game/phaser-room-shell.tsx
client/components/PhaserGame.tsx
client/lib/game-socket-client.ts
client/lib/SocketClient.ts
client/phaser/scenes/BoardScene.ts
client/phaser/scenes/UIScene.ts
```

Điểm quan trọng:

```text
- /game/[roomId] là route fullscreen.
- Game route không nên hiển thị lobby HUD/nav thông thường.
- Nếu refresh trong game, client chỉ vào lại được nếu game room vẫn còn trong memory của game server.
- Nếu game server restart, active GameRoom mất vì game state hiện chưa persist DB/Redis.
```

### 2.9. Luồng Gameplay Realtime

Game server là authoritative source of truth.

```text
Client Phaser
  -> Socket.IO event tới server/game
  -> SocketHandler validate payload cơ bản
  -> GameRoom kiểm tra player/turn/phase
  -> TurnEngine/GameState/Board/Card xử lý luật
  -> Server broadcast public state
  -> Server gửi private update riêng từng player
```

Gameplay events chính:

```text
player:move
player:pick_spawn
player:play_card
player:end_card_phase
player:discard_cards
player:request_state
```

Server emits chính:

```text
room:game_starting
game:state_update
game:private_update
game:error
match:found
party:update
matchmaking:queue_update
```

### 2.10. Luồng Game End Và Reward

Khi game kết thúc:

```text
1. Core game xác định team thắng/thua.
2. Game server gọi API internal:
   POST /api/internal/matches/reward
3. Header:
   x-game-server-secret: <GAME_SERVER_INTERNAL_SECRET>
4. API validate secret.
5. API update PostgreSQL:
   - team thắng: +10 coins, +1 gems, +200 elo mỗi người
   - team thua: +2 coins mỗi người
6. API lưu match history/participants nếu payload có đủ dữ liệu.
```

File liên quan:

```text
server/game/src/services/MatchRewardClient.ts
server/api/src/routes/internal-match.routes.ts
server/api/prisma/schema.prisma
```

Điểm dễ lỗi:

```text
- GAME_SERVER_INTERNAL_SECRET của server/game và server/api phải giống nhau.
- API_BASE_URL trong server/game phải trỏ đúng tới API server.
- Nếu deploy domain, API_BASE_URL thường là https://api.qgiaaa.me.
```

### 2.11. Luồng Shop/Admin/Frame Apply

Admin:

```text
1. Admin login, user.role = ADMIN.
2. Admin vào /admin/shop.
3. Admin tạo ShopItem type SKIN hoặc ITEM.
4. Với SKIN hiện chỉ hỗ trợ metadata.skinType = "FRAME".
5. Admin có thể:
   - nhập imageUrl
   - upload ảnh local VPS qua /api/admin/shop/upload
6. API lưu upload vào server/api/uploads/shop.
7. API serve static file ở /uploads.
```

User:

```text
1. User vào /shop.
2. Client gọi GET /api/shop/items.
3. API chỉ trả active SKIN/ITEM, kèm ownedQuantity/isApplied.
4. User mua item:
   POST /api/shop/buy { itemId }
5. Nếu là frame đã mua rồi:
   - không tăng quantity
   - không trừ tiền lần nữa
6. User apply frame:
   POST /api/shop/apply { itemId }
7. API set User.equippedFrameItemId.
8. Client update auth store.
9. AuthenticatedShell đổi avatar frame ngay.
```

File liên quan:

```text
client/app/(authenticated)/shop/page.tsx
client/app/(authenticated)/admin/shop/page.tsx
client/lib/api/shop.ts
client/components/app/authenticated-shell.tsx
server/api/src/routes/shop.routes.ts
server/api/src/routes/admin-shop.routes.ts
server/api/prisma/schema.prisma
```

Điểm quan trọng:

```text
- DB enum vẫn giữ CARD để tránh migration rủi ro.
- UI/API admin không cho tạo CARD nữa.
- Public shop không nên hiển thị CARD.
- Upload V1 là local file storage, cần backup folder uploads khi deploy VPS.
```

## 3. Công Nghệ Sử Dụng Theo Từng Thành Phần

### 3.1. Client

Folder:

```text
client/
```

Tech stack:

```text
Next.js 14
React 18
TypeScript
Tailwind CSS
Phaser 3
Zustand
socket.io-client
ESLint
PostCSS/Autoprefixer
```

Vai trò:

```text
- Frontend chính của sản phẩm.
- Render auth/login/register.
- Render lobby, shop, friends, chat, leaderboard, settings, admin shop.
- Render matchmaking flow.
- Render game route fullscreen.
- Mount Phaser game canvas.
- Kết nối HTTP tới API server.
- Kết nối Socket.IO tới API server cho social socket.
- Kết nối Socket.IO tới game server cho matchmaking/gameplay.
```

Các file quan trọng:

```text
client/app/layout.tsx
client/app/globals.css
client/app/(authenticated)/layout.tsx
client/components/app/authenticated-shell.tsx
client/components/app/settings-modal.tsx
client/components/app/guidebook-modal.tsx

client/app/(authenticated)/lobby/page.tsx
client/app/(authenticated)/matchmaking/page.tsx
client/app/(authenticated)/matchmaking/party-2/page.tsx
client/app/(authenticated)/matchmaking/party-4/page.tsx
client/components/matchmaking/matchmaking-flow.tsx

client/app/(authenticated)/game/[roomId]/page.tsx
client/components/game/phaser-room-shell.tsx
client/components/PhaserGame.tsx

client/lib/api/auth.ts
client/lib/api/users.ts
client/lib/api/shop.ts
client/lib/api/friends.ts
client/lib/api/chat.ts
client/lib/socket/client.ts
client/lib/game-socket-client.ts
client/lib/SocketClient.ts
```

### 3.2. API Server

Folder:

```text
server/api/
```

Tech stack:

```text
Node.js
Express
TypeScript
Prisma
PostgreSQL
JWT
bcryptjs
cors
Socket.IO
tsx for dev
```

Vai trò:

```text
- Account/register/login.
- JWT auth.
- User profile/safe user.
- Friends/search/request.
- Chat HTTP APIs.
- Public shop APIs.
- Admin shop APIs.
- Upload shop images.
- Internal reward endpoint cho game server.
- Serve static uploads.
- API socket server cho authenticated/social socket.
```

Entrypoint:

```text
server/api/src/index.ts
```

Mounted routes:

```text
/api/auth
/api/users
/api/friends
/api/chat
/api/shop
/api/admin/shop
/api/internal/matches
/uploads
/api/health
```

Route summary:

```text
POST /api/auth/register
POST /api/auth/login

GET   /api/users/leaderboard
GET   /api/users/me
PATCH /api/users/me/password
PATCH /api/users/me/avatar
GET   /api/users/:username

GET   /api/friends/search
POST  /api/friends/requests
GET   /api/friends/requests/pending
PATCH /api/friends/requests/:requestId
GET   /api/friends

GET  /api/chat/conversations
GET  /api/chat/messages/:friendId
POST /api/chat/messages/:friendId

GET  /api/shop/items
GET  /api/shop/cards
POST /api/shop/buy
POST /api/shop/apply

GET    /api/admin/shop/items
POST   /api/admin/shop/items
PATCH  /api/admin/shop/items/:id
PATCH  /api/admin/shop/items/:id/toggle-active
DELETE /api/admin/shop/items/:id
POST   /api/admin/shop/upload

POST /api/internal/matches/reward
GET  /api/health
```

API CORS:

```text
server/api/src/config/origins.ts
FRONTEND_ORIGINS hoặc FRONTEND_ORIGIN
```

Điểm dễ lỗi:

```text
- Nếu frontend là https://www.qgiaaa.me nhưng FRONTEND_ORIGINS chỉ có https://qgiaaa.me, browser sẽ block CORS.
- Next public env được bake lúc build, đổi .env.local xong phải build/restart lại client.
- Upload local nằm trong server/api/uploads, deploy mới phải giữ/persist folder này.
```

### 3.3. Game Server

Folder:

```text
server/game/
```

Tech stack:

```text
Node.js
Express
TypeScript
Socket.IO
uuid
ts-node/nodemon dev
```

Vai trò:

```text
- Realtime Socket.IO server cho matchmaking.
- Quản lý solo queue.
- Quản lý party2/party4.
- Tạo GameRoom.
- Chạy authoritative game state.
- Validate turn/phase/action.
- Broadcast public state/private state.
- Xử lý disconnect trong queue/party/game.
- Gọi API reward khi match kết thúc.
```

Entrypoint:

```text
server/game/src/index.ts
```

Health:

```text
GET /health
```

Socket handler:

```text
server/game/src/socket/SocketHandler.ts
```

Matchmaking manager:

```text
server/game/src/matchmaking/MatchmakingManager.ts
```

Core game files:

```text
server/game/src/game/GameState.ts
server/game/src/game/GameRoom.ts
server/game/src/game/RoomManager.ts
server/game/src/game/TurnEngine.ts
server/game/src/game/Board.ts
server/game/src/game/Card.ts
server/game/src/game/CardDeck.ts
server/game/src/game/MovementValidator.ts
server/game/src/game/WinLossChecker.ts
server/game/src/game/Player.ts
```

Điểm cực kỳ quan trọng:

```text
- GameState là nguồn sự thật cho trận đấu.
- Game state hiện in-memory, không lưu Postgres/Redis.
- Server restart sẽ mất active rooms.
- Gameplay không nên tin client.
- Client chỉ gửi ý định/action, server quyết định hợp lệ hay không.
```

### 3.4. Shared

Folder:

```text
shared/
```

Vai trò:

```text
- Chứa shared TypeScript types/contracts.
- Export types từ shared/types/game-state.ts.
- Có thể dùng để đồng bộ contract giữa client và server.
```

Lưu ý:

```text
- Một số types đang duplicate ở client/server.
- Nếu muốn làm sạch lâu dài, nên đưa socket payload/game contracts quan trọng về shared.
```

### 3.5. Database Và Infra Local

File:

```text
docker-compose.yml
```

Services:

```text
PostgreSQL 16 Alpine
Redis 7 Alpine
```

PostgreSQL:

```text
container: logic_game2_clean_postgres
host port: 127.0.0.1:25432
container port: 5432
database: zodiac_game
user: zodiac_user
password: zodiac_password
```

Redis:

```text
container: logic_game2_clean_redis
host port: 127.0.0.1:26379
container port: 6379
```

Lưu ý về Redis:

```text
- Redis có trong docker-compose và env.
- Code runtime hiện tại không thấy dùng Redis làm game state store chính.
- Nếu cần scale game server nhiều instance, cần thiết kế lại state/session/pubsub.
```

## 4. Database Model Quan Trọng

Schema:

```text
server/api/prisma/schema.prisma
```

### 4.1. User

Fields quan trọng:

```text
id
username
passwordHash
avatar
role: USER | ADMIN
elo
coins
gems
equippedFrameItemId
createdAt
updatedAt
```

Quan hệ:

```text
friendshipsInitiated
friendshipsReceived
inventoryItems
equippedFrameItem
wonMatches
matchParticipations
sentMessages
receivedMessages
```

### 4.2. ShopItem

Fields:

```text
id
type: CARD | SKIN | ITEM
code
name
description
imageUrl
priceCoins
priceGems
isActive
metadata
createdAt
updatedAt
```

Hiện tại business rule:

```text
- UI/Admin chỉ dùng SKIN và ITEM.
- SKIN hiện chỉ hỗ trợ FRAME qua metadata.skinType = "FRAME".
- CARD còn trong enum/model để tránh migration rủi ro và tương thích tương lai.
```

### 4.3. UserInventory

Fields:

```text
id
userId
itemId
quantity
acquiredAt
```

Rule:

```text
- unique(userId, itemId)
- frame là unique ownership: mua rồi không tăng quantity và không trừ tiền lần nữa.
- item thường có thể stack quantity.
```

### 4.4. Friendship

Fields:

```text
id
user1Id
user2Id
status: PENDING | ACCEPTED
createdAt
updatedAt
```

Rule:

```text
- unique(user1Id, user2Id)
- dùng cho friends/search/request/chat visibility.
```

### 4.5. MatchHistory Và MatchParticipant

Mục tiêu:

```text
- Lưu lịch sử trận.
- Lưu người tham gia.
- Kết nối reward/game result về user.
```

Hiện reward được xử lý qua internal endpoint từ game server.

### 4.6. ChatMessage

Fields:

```text
id
senderId
receiverId
content
createdAt
```

Chat hiện là HTTP API + API Socket.IO hỗ trợ authenticated socket foundation.

## 5. Socket.IO Trong Project

Project có 2 Socket.IO channel khác nhau. Đây là điểm rất dễ nhầm.

### 5.1. API Socket

Server:

```text
server/api/src/socket/server.ts
```

Client:

```text
client/lib/socket/client.ts
```

Mục đích:

```text
- Authenticated socket bằng JWT.
- Social/chat/future realtime API.
- Không phải socket gameplay chính.
```

Auth:

```text
socket.handshake.auth.token
Authorization: Bearer <token>
```

Events hiện có:

```text
socket_ready
join_queue
leave_queue
join_room
disconnect
```

### 5.2. Game Socket

Server:

```text
server/game/src/socket/SocketHandler.ts
```

Client matchmaking:

```text
client/lib/game-socket-client.ts
```

Client gameplay:

```text
client/lib/SocketClient.ts
```

Mục đích:

```text
- Matchmaking.
- Party.
- Game room.
- Gameplay action.
- State broadcast.
```

Matchmaking events client -> server:

```text
matchmaking:quick_join
matchmaking:quick_cancel
party:create
party:join
party:leave
party:switch_slot
party:ready
party:start_queue
```

Matchmaking events server -> client:

```text
matchmaking:queue_update
party:update
match:found
game:error
```

Game events client -> server:

```text
room:create
room:join
room:leave
room:ready
debug:fill_room
player:move
player:pick_spawn
player:play_card
player:end_card_phase
player:discard_cards
player:request_state
```

Game events server -> client:

```text
room:created
room:joined
room:player_joined
room:player_left
room:game_starting
game:state_update
game:private_update
game:error
```

Payload style:

```text
- Một số event support payload raw.
- Một số event support wrapped payload { data: ... } qua unwrapPayload pattern.
- Client nên xử lý cả hai để tránh mismatch.
```

## 6. Game Core 2v2

Game server hiện đã là 2v2.

Các rule chính:

```text
- 4 players.
- 2 teams: team1, team2.
- Mỗi team có 2 players.
- Team win khi totalClaimed >= 10.
- Có teamId, teamSlot, TeamInfo.
- Có tether/spawn/lock/skip/respawn.
- Có bài team-play như Change teammate, Swap teammate.
```

Turn order authoritative:

```text
team1-slot0 -> team2-slot0 -> team1-slot1 -> team2-slot1
```

GameState creation:

```text
GameState.create(...)
  - legacy/debug path
  - tự shuffle/team assignment

GameState.createWithTeams(...)
  - path dùng bởi matchmaking
  - nhận team/slot deterministic
  - validate đủ 4 team slot
```

Runtime player id:

```text
MatchmakingManager tạo runtime id dạng:
userId::socketId
```

Lý do:

```text
- Tránh collision nếu cùng user/multi-tab/reconnect.
- GameRoom/GameState dùng runtime id làm playerId trong trận.
- match:found trả yourPlayerId là runtime id để Phaser gửi action đúng player.
```

Điểm cần nhớ khi debug "not your turn":

```text
- UI phải dùng yourPlayerId từ match:found, không dùng raw user.id.
- Nếu dùng user.id thay vì runtime id, server sẽ không tìm đúng player trong GameState.
```

## 7. Frontend Game/Phaser

### 7.1. PhaserGame

File:

```text
client/components/PhaserGame.tsx
```

Vai trò:

```text
- Dynamic import Phaser.
- Tạo Phaser.Game.
- Config 1280x720.
- Scale FIT/CENTER_BOTH.
- Mount scenes.
- Inject roomId/playerId vào registry.
```

Scenes:

```text
PreloadScene
BoardScene
UIScene
```

### 7.2. BoardScene

Vai trò:

```text
- Render board/game world.
- Nhận state updates.
- Gửi gameplay action qua SocketClient.
- Xử lý click board/card/player target.
- Điều phối card preview/double click popup.
```

### 7.3. UIScene

Vai trò:

```text
- Render dice/timer/card panel/player info panel.
- Render gameover/discard/move pad.
- Không nên chứa source of truth gameplay.
```

### 7.4. CardPanel

Vai trò:

```text
- Render hand cards.
- Single click dùng lá bài nếu hợp lệ.
- Double click mở popup preview lá bài.
- Click ngoài popup đóng preview.
```

Điểm quan trọng:

```text
- Lá "thêm lượt" và "swap" cần phân biệt single click/double click.
- Single click có delay ngắn để tránh double click bị hiểu thành play card.
```

### 7.5. PlayerInfoPanel

Vai trò:

```text
- Render panel người chơi.
- Hiển thị team/player/zodiac/progress/card count/distance.
- Highlight lượt hiện tại bằng blink con giáp.
```

## 8. Environment Variables

### 8.1. Client

File:

```text
client/.env.local
client/.env.example
```

Variables:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_GAME_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:3001
```

Production example:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.qgiaaa.me
NEXT_PUBLIC_GAME_SOCKET_URL=https://game.qgiaaa.me
```

Important:

```text
- NEXT_PUBLIC_* được bake vào bundle lúc next build.
- Đổi env production xong phải chạy lại npm run build --prefix client và restart client.
```

### 8.2. API Server

File:

```text
server/api/.env
server/api/.env.example
```

Variables:

```text
PORT=4000
FRONTEND_ORIGIN=http://localhost:3000
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=postgresql://zodiac_user:zodiac_password@localhost:25432/zodiac_game?schema=public
REDIS_URL=redis://localhost:26379
JWT_SECRET=change_me_for_local_dev
JWT_EXPIRES_IN=7d
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_AVATAR=
GAME_SERVER_INTERNAL_SECRET=dev_internal_secret_change_me
```

Production notes:

```text
FRONTEND_ORIGINS=https://qgiaaa.me,https://www.qgiaaa.me
JWT_SECRET phải mạnh.
DATABASE_URL phải trỏ đúng Postgres production.
GAME_SERVER_INTERNAL_SECRET phải giống bên server/game.
```

### 8.3. Game Server

Variables:

```text
PORT=3001
FRONTEND_ORIGIN=http://localhost:3000
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
API_BASE_URL=http://localhost:4000
GAME_SERVER_INTERNAL_SECRET=dev_internal_secret_change_me
```

Production notes:

```text
FRONTEND_ORIGINS=https://qgiaaa.me,https://www.qgiaaa.me
API_BASE_URL=https://api.qgiaaa.me
GAME_SERVER_INTERNAL_SECRET giống API
```

## 9. Local Development

Chạy full stack:

```bash
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Root scripts:

```text
npm run db:up
npm run db:down
npm run db:restart
npm run db:logs
npm run db:migrate
npm run db:seed
npm run db:studio
npm run dev
npm run build
```

Build:

```bash
npm run build
```

Build root chạy tuần tự:

```text
server/game build
server/api build
client build
```

## 10. Deployment Notes

### 10.1. PM2 Processes Khuyến Nghị

```bash
pm2 start server/api/dist/index.js --name logic-api --update-env
pm2 start server/game/dist/index.js --name logic-game --update-env
pm2 start npm --name logic-client --cwd /var/www/NT208-Project/client -- start
pm2 save
```

Không dùng:

```bash
pm2 start npm --name logic-client --prefix client -- start
```

Vì PM2 không hiểu `--prefix` theo cách npm command trực tiếp.

### 10.2. Health Checks

```text
API:
GET https://api.qgiaaa.me/api/health

Game:
GET https://game.qgiaaa.me/health

Client:
GET https://qgiaaa.me
GET https://www.qgiaaa.me
```

### 10.3. CORS Checklist

Nếu browser báo:

```text
Access-Control-Allow-Origin has value https://qgiaaa.me
but origin is https://www.qgiaaa.me
```

Fix:

```text
FRONTEND_ORIGINS=https://qgiaaa.me,https://www.qgiaaa.me
```

Restart API và game server.

### 10.4. WebSocket Checklist

Nếu client không connect được `game.qgiaaa.me`:

```text
- Game PM2 process có online không?
- Port 3001 có listen không?
- Nginx game domain proxy đúng port 3001 không?
- Nginx có Upgrade/Connection headers không?
- FRONTEND_ORIGINS game server có chứa đúng origin không?
- Client .env build-time có NEXT_PUBLIC_GAME_SOCKET_URL=https://game.qgiaaa.me không?
```

## 11. Những Điểm Quan Trọng Và Rủi Ro

### 11.1. Game State In-Memory

Game room và game state hiện nằm trong memory của `server/game`.

Hệ quả:

```text
- Server restart làm mất trận đang chơi.
- Không thể scale nhiều game server instance nếu chưa có sticky session/state store.
- Redis hiện có nhưng chưa làm authoritative game state store.
```

### 11.2. Hai Socket Client Dễ Nhầm

```text
client/lib/socket/client.ts
  -> API socket, JWT, social/authenticated realtime.

client/lib/game-socket-client.ts
  -> Game socket, matchmaking/party/match:found.

client/lib/SocketClient.ts
  -> Game socket wrapper cho Phaser gameplay events.
```

Khi debug game, thường cần nhìn `game-socket-client.ts` và `SocketClient.ts`, không phải chỉ API socket.

### 11.3. Matchmaking MVP Tin Player Payload

Matchmaking hiện nhận:

```text
player.id
player.username
player.avatar
player.elo
authToken?
```

MVP đang tin payload client ở game server. Production nên verify token với API hoặc shared JWT secret.

### 11.4. User ID Khác Runtime Player ID

Trong matchmaking:

```text
raw user id:    user.id từ API
runtime id:     user.id::socket.id
```

Trong game action phải dùng runtime id từ `yourPlayerId`.

Nếu dùng nhầm raw user id:

```text
- pick spawn không chạy
- move bị báo không đúng lượt
- play card bị reject
```

### 11.5. Next.js Env Là Build-Time

Các biến:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_GAME_SOCKET_URL
```

phải đúng trước khi `next build`.

Đổi `.env.local` sau build không đủ, phải build lại.

### 11.6. Upload Local Cần Backup

Admin upload shop image vào:

```text
server/api/uploads/shop
```

Nếu deploy lại bằng cách xoá folder project, ảnh upload sẽ mất nếu không backup/persist.

### 11.7. CARD Vẫn Có Trong DB

DB vẫn giữ:

```text
ShopItemType.CARD
Card model legacy
```

Nhưng business hiện tại:

```text
- Admin chỉ tạo SKIN/ITEM.
- Public shop chỉ hiển thị active SKIN/ITEM.
- CARD giữ để tránh migration rủi ro và tương thích cũ.
```

### 11.8. Profile Routes Đã Bị Vô Hiệu Hóa Theo Yêu Cầu UI

Một số flow profile có thể redirect về lobby hoặc không còn hiệu lực. Nếu sau này muốn bật lại profile, cần kiểm tra:

```text
client/app/(authenticated)/profile/page.tsx
client/app/(authenticated)/profile/[username]/page.tsx
client/lib/api/users.ts
server/api/src/routes/user.routes.ts
```

### 11.9. Một Số Text Mojibake Có Thể Còn Trong Code Cũ

Một số file cũ có thể còn text tiếng Việt lỗi encoding. Nên ưu tiên sửa ở UI component đang render trực tiếp thay vì sửa lan man toàn repo.

Các nơi hay gặp:

```text
client/components/matchmaking/matchmaking-flow.tsx
client/components/game/phaser-room-shell.tsx
client/components/app/guidebook-modal.tsx
shared/types/game-state.ts
```

## 12. Checklist Khi Debug Các Lỗi Hay Gặp

### 12.1. Login/Register Failed To Fetch

Kiểm tra:

```text
- API server port 4000 có chạy không?
- NEXT_PUBLIC_API_BASE_URL trong client có đúng không?
- Browser origin có nằm trong FRONTEND_ORIGINS API không?
- Nginx api.qgiaaa.me proxy đúng 4000 không?
- HTTPS certificate/domain có đúng không?
```

### 12.2. Tạo Phòng Không Ra Code

Kiểm tra:

```text
- Client có connect tới game server không?
- NEXT_PUBLIC_GAME_SOCKET_URL có đúng không?
- Game server port 3001 có chạy không?
- Nginx game.qgiaaa.me có WebSocket upgrade không?
- FRONTEND_ORIGINS game server có chứa origin frontend không?
- Browser console có connect_error/websocket error không?
```

### 12.3. Party Người Vào Được Người Không Vào Game

Kiểm tra:

```text
- Server có emit match:found tới từng socketId không?
- party matched có xóa socketToParty quá sớm không?
- Client listener onMatchFound có active ở tất cả tab không?
- Client có lưu match context localStorage không?
- /game/[roomId] có nhận đúng yourPlayerId không?
```

### 12.4. Đúng Lượt Nhưng Server Báo Not Your Turn

Kiểm tra:

```text
- Client đang dùng runtime player id hay raw user.id?
- match:found.yourPlayerId có được lưu không?
- PhaserRoomShell có truyền đúng playerId vào PhaserGame không?
- SocketClient action payload có đúng playerId không?
```

### 12.5. Game Không Cộng Thưởng

Kiểm tra:

```text
- Game server có gọi MatchRewardClient không?
- API_BASE_URL bên game server có đúng không?
- GAME_SERVER_INTERNAL_SECRET hai bên có giống không?
- API /api/internal/matches/reward có log lỗi không?
- User IDs trong reward có phải DB user id không, không phải runtime id userId::socketId?
```

### 12.6. Admin Upload Ảnh Thành Công Nhưng Ảnh Không Hiển Thị

Kiểm tra:

```text
- API có serve /uploads không?
- Nginx api domain có proxy /uploads về API không?
- imageUrl trả về có đúng domain/protocol không?
- File có tồn tại trong server/api/uploads/shop không?
```

## 13. File Map Nhanh

### Client UI

```text
client/app/globals.css
client/components/app/authenticated-shell.tsx
client/components/app/settings-modal.tsx
client/components/app/guidebook-modal.tsx
client/components/layout/fixed-aspect-scene.tsx
```

### Client Pages

```text
client/app/login/page.tsx
client/app/register/page.tsx
client/app/(authenticated)/lobby/page.tsx
client/app/(authenticated)/matchmaking/page.tsx
client/app/(authenticated)/shop/page.tsx
client/app/(authenticated)/friends/page.tsx
client/app/(authenticated)/chat/page.tsx
client/app/(authenticated)/leaderboard/page.tsx
client/app/(authenticated)/admin/shop/page.tsx
client/app/(authenticated)/game/[roomId]/page.tsx
```

### Client Networking

```text
client/lib/api/auth.ts
client/lib/api/users.ts
client/lib/api/shop.ts
client/lib/api/friends.ts
client/lib/api/chat.ts
client/lib/socket/client.ts
client/lib/game-socket-client.ts
client/lib/SocketClient.ts
```

### Phaser

```text
client/components/PhaserGame.tsx
client/phaser/scenes/PreloadScene.ts
client/phaser/scenes/BoardScene.ts
client/phaser/scenes/UIScene.ts
client/phaser/objects/BoardRenderer.ts
client/phaser/objects/CardPanel.ts
client/phaser/objects/PlayerInfoPanel.ts
client/phaser/objects/DiceDisplay.ts
client/phaser/objects/TimerBar.ts
```

### API Server

```text
server/api/src/index.ts
server/api/src/config/origins.ts
server/api/src/lib/prisma.ts
server/api/src/middleware/auth.middleware.ts
server/api/src/utils/safe-user.ts
server/api/src/socket/server.ts
server/api/src/routes/auth.routes.ts
server/api/src/routes/user.routes.ts
server/api/src/routes/friend.routes.ts
server/api/src/routes/chat.routes.ts
server/api/src/routes/shop.routes.ts
server/api/src/routes/admin-shop.routes.ts
server/api/src/routes/internal-match.routes.ts
server/api/prisma/schema.prisma
server/api/prisma/seed.ts
```

### Game Server

```text
server/game/src/index.ts
server/game/src/socket/SocketHandler.ts
server/game/src/matchmaking/MatchmakingManager.ts
server/game/src/services/MatchRewardClient.ts
server/game/src/types/index.ts
server/game/src/game/RoomManager.ts
server/game/src/game/GameRoom.ts
server/game/src/game/GameState.ts
server/game/src/game/TurnEngine.ts
server/game/src/game/Board.ts
server/game/src/game/Card.ts
server/game/src/game/CardDeck.ts
server/game/src/game/MovementValidator.ts
server/game/src/game/WinLossChecker.ts
```

### Shared

```text
shared/index.ts
shared/types/game-state.ts
```

## 14. Kết Luận Kiến Trúc

Project hiện là một web game có 3 runtime chính:

```text
1. Next.js client:
   UI chính + Phaser render + HTTP/Socket clients.

2. API backend:
   Auth/account/social/shop/admin/reward + PostgreSQL.

3. Game backend:
   Matchmaking + realtime authoritative gameplay.
```

Luồng quan trọng nhất:

```text
Login/Register
  Browser -> client -> server/api -> PostgreSQL

Shop/Admin
  Browser -> client -> server/api -> PostgreSQL/uploads

Matchmaking
  Browser -> client -> server/game Socket.IO

Game
  Browser -> /game/[roomId] -> Phaser -> server/game Socket.IO

Reward
  server/game -> server/api internal HTTP -> PostgreSQL
```

Điểm cần bảo vệ kỹ nhất khi phát triển tiếp:

```text
- Không trộn nhầm API socket và game socket.
- Không dùng raw user.id thay runtime player id trong trận.
- Không để CORS thiếu www/root domain.
- Không deploy game.qgiaaa.me thiếu WebSocket upgrade.
- Không quên build lại client sau khi đổi NEXT_PUBLIC_* env.
- Không coi Redis là game state store khi code hiện tại vẫn in-memory.
```
## Cấu trúc thư mục 
**Repo Chuẩn**
Folder project hoàn chỉnh hiện tại là:

`D:\Users\PC\Desktop\Logic_game2\Logic_game2_formatted`

Các folder ngoài `Logic_game2_formatted` như `UI`, `server`, `client`, `Logic_game2_complete`, `RepoComplete_2026-05-25`, `tmp` ở folder cha chủ yếu là bản cũ/backup/tạm. Khi code tiếp, nên ưu tiên làm trong `Logic_game2_formatted`.

**Cấu Trúc Chính**
```text
Logic_game2_formatted/
  client/
  server/
  shared/
  tmp/
  node_modules/
  docker-compose.yml
  package.json
  README.md
  INFORMATION.md
```

**Root Folder**
`client`

Frontend chính của game. Chứa toàn bộ UI web: login, register, lobby, shop, friends, chat, leaderboard, admin shop, matchmaking và màn hình game Phaser.

`server`

Chứa backend, tách thành 2 server riêng:

```text
server/api
server/game
```

`shared`

Chứa type/contract dùng chung giữa các phần. Hiện vẫn còn nhẹ, nhưng là nơi nên đặt các type chung nếu muốn tránh duplicate giữa client/server.

`tmp`

Folder tạm/backup/script cleanup. Không phải source chính của app.

`node_modules`

Thư viện npm đã cài. Không push lên git.

`.git`

Git repository của project formatted.

`docker-compose.yml`

Cấu hình chạy PostgreSQL và Redis local.

`package.json`

Script root để chạy toàn bộ project: DB, API server, game server, client.

**Client Folder**
`client/app`

Next.js App Router. Chứa các page/route chính.

```text
client/app/login
client/app/register
client/app/(authenticated)/lobby
client/app/(authenticated)/matchmaking
client/app/(authenticated)/game/[roomId]
client/app/(authenticated)/shop
client/app/(authenticated)/friends
client/app/(authenticated)/chat
client/app/(authenticated)/leaderboard
client/app/(authenticated)/admin/shop
```

`client/components`

Các React component dùng lại trong UI.

`client/components/app`

Component shell/UI chung: authenticated shell, settings modal, guidebook modal, click SFX, rank badge.

`client/components/auth`

Component cho login/register UI.

`client/components/game`

Component wrapper cho màn hình game, ví dụ `PhaserRoomShell`.

`client/components/layout`

Component layout cố định aspect ratio.

`client/components/matchmaking`

UI tạo phòng, nhập mã phòng, party 2, party 4, quick queue.

`client/lib`

Helper/frontend logic.

`client/lib/api`

HTTP client gọi `server/api`, ví dụ auth, users, shop, friends, chat.

`client/lib/socket`

Socket client cho API server. Đây không phải socket gameplay chính.

`client/lib/types`

TypeScript types phía frontend.

`client/lib/game-socket-client.ts`

Socket client cho matchmaking/game server. Dùng để tạo phòng, vào phòng, ready, nhận `match:found`.

`client/lib/SocketClient.ts`

Socket wrapper cho Phaser gameplay. Dùng để gửi `player:move`, `player:play_card`, `player:pick_spawn`, `player:request_state`.

`client/phaser`

Toàn bộ game engine phía frontend.

`client/phaser/scenes`

Các scene Phaser như preload, board, UI.

`client/phaser/objects`

Các object render trong game: board renderer, card panel, dice, player info panel.

`client/phaser/assets`

Asset riêng cho Phaser nếu có.

`client/public`

Static assets web: ảnh UI, SVG, music, background, game UI.

`client/store`

Zustand store, ví dụ auth store.

`client/types`

Type riêng khác nếu có.

**Server/API Folder**
`server/api`

Backend account/auth/shop/social/admin. Server này chạy port `4000`.

`server/api/src`

Source chính của API server.

`server/api/src/routes`

Các route HTTP.

```text
auth.routes.ts
user.routes.ts
friend.routes.ts
chat.routes.ts
shop.routes.ts
admin-shop.routes.ts
internal-match.routes.ts
```

`server/api/src/middleware`

Middleware Express, quan trọng nhất là auth/admin middleware.

`server/api/src/lib`

Helper backend, ví dụ Prisma client.

`server/api/src/config`

Config API, ví dụ allowed origins/CORS.

`server/api/src/socket`

Socket.IO server của API. Chủ yếu cho social/authenticated socket, không phải gameplay socket.

`server/api/src/utils`

Utility như safe user mapping.

`server/api/prisma`

Prisma schema, migrations, seed admin.

`server/api/prisma/schema.prisma`

Định nghĩa DB models: User, ShopItem, UserInventory, Friendship, ChatMessage, MatchHistory.

`server/api/prisma/migrations`

Lịch sử migration database.

`server/api/prisma/seed.ts`

Script tạo/cập nhật admin account từ env.

`server/api/uploads`

Ảnh upload từ admin shop, ví dụ frame/trang phục. Folder này cần backup khi deploy VPS.

**Server/Game Folder**
`server/game`

Realtime game server. Server này chạy port `3001`.

`server/game/src`

Source chính của game server.

`server/game/src/index.ts`

Entrypoint game server: tạo Express + Socket.IO, setup CORS, setup socket handler.

`server/game/src/socket`

Socket handler cho matchmaking và gameplay events.

`server/game/src/matchmaking`

Matchmaking manager. Quản lý quick queue, party 2, party 4, ready, tạo match, emit `match:found`.

`server/game/src/game`

Core game logic.

Các file quan trọng trong `server/game/src/game`:

```text
GameState.ts
GameRoom.ts
RoomManager.ts
TurnEngine.ts
Board.ts
Card.ts
CardDeck.ts
MovementValidator.ts
WinLossChecker.ts
Player.ts
```

`server/game/src/services`

Service phụ của game server, ví dụ gọi API để cộng thưởng sau trận.

`server/game/src/types`

TypeScript types cho game server.

`server/game/dist`

Output sau khi build TypeScript. Dùng khi deploy production.

**Shared Folder**
`shared/types`

Type dùng chung. Hiện có game state contracts.

`shared/index.ts`

Export shared types.

`shared/package.json`

Package config cho workspace `shared`.

**Folder Cha Ngoài Repo Formatted**
`UI`

Repo UI cũ trước khi merge. Không nên sửa nếu đang làm bản merged hiện tại.

`server`

Server cũ trước khi format/merge. Không nên dùng làm source chính nữa.

`client`

Client cũ hoặc bản còn sót ngoài formatted. Không phải client chính hiện tại.

`Logic_game2_complete`

Bản complete/backup cũ.

`RepoComplete_2026-05-25`

Backup snapshot cũ.

`Research`

Tài liệu/nghiên cứu, không phải runtime source.

`tmp`

Folder tạm ở ngoài repo, chứa script/backup cleanup.

**Tóm Tắt Dễ Nhớ**
```text
client      = frontend + Phaser render
server/api  = auth, user, shop, admin, friends, chat, reward, PostgreSQL
server/game = matchmaking, party, realtime gameplay, game state
shared      = type dùng chung
```

Nếu bạn muốn sửa UI, vào `client`.

Nếu bạn muốn sửa login/shop/admin/friends/database, vào `server/api`.

Nếu bạn muốn sửa tạo phòng/vào trận/luật game/lượt chơi/card/move, vào `server/game`.

Nếu bạn muốn sửa type chung hoặc contract, cân nhắc `shared`.