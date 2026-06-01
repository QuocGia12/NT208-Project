# Formatted Project (client / server / shared)

## Structure
- `client`: Next.js frontend
- `server/game`: realtime game server (Socket.IO + game rules)
- `server/api`: account/auth/social/shop API backend
- `shared`: shared types/contracts

## Run
1. `npm install`
2. `npm run db:up`
3. `npm run db:migrate`
4. `npm run db:seed`
5. `npm run dev`

Default ports:
- client: `3000`
- game server: `3001`
- api server: `4000`
- postgres: `25432`
- redis: `26379`

Useful commands:
- `npm run db:up`: start Postgres and Redis
- `npm run db:down`: stop Postgres and Redis
- `npm run db:restart`: restart Postgres and Redis if a Docker port is stuck
- `npm run db:migrate`: apply Prisma migrations
- `npm run db:seed`: create/update the admin account from `server/api/.env`
- `npm run db:studio`: open Prisma Studio
- `npm run dev`: start DB, game server, API server, and frontend

## Environment
Copy or edit `server/api/.env` before running migrations/seeds.

Required API values:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `FRONTEND_ORIGINS`: comma-separated allowed frontend origins, for example `http://localhost:3000,https://qgiaaa.me,https://www.qgiaaa.me`
- `GAME_SERVER_INTERNAL_SECRET`: shared secret used by the game server to award match rewards
- `ADMIN_USERNAME`: admin seed username, default `admin`
- `ADMIN_PASSWORD`: admin seed password, default `admin123`
- `ADMIN_AVATAR`: optional admin avatar URL

Game server values:
- `API_BASE_URL`: API server URL used for match rewards, default local value is `http://localhost:4000`
- `GAME_SERVER_INTERNAL_SECRET`: must match the API value above

Client values are in `client/.env.local`:
- `NEXT_PUBLIC_API_BASE_URL`: API server URL, default local value is `http://localhost:4000`
- `NEXT_PUBLIC_GAME_SOCKET_URL`: realtime game server URL, default local value is `http://localhost:3001`
- `NEXT_PUBLIC_GAME_SERVER_URL`: legacy fallback for the same realtime game server URL

## Admin Shop
Run `npm run db:seed` after migrations to create the admin user. Normal users cannot self-register as admin.

Admin features:
- Admin login returns `role=ADMIN`.
- Admin-only page: `/admin/shop`
- Admin APIs: `GET/POST/PATCH/DELETE /api/admin/shop/items`
- Toggle active status: `PATCH /api/admin/shop/items/:id/toggle-active`

Shop item types:
- `SKIN`: shown in the `TRANG PHỤC` tab
- `ITEM`: shown in the `VẬT PHẨM` tab
- `CARD`: kept for future card shop compatibility

Public shop APIs:
- `GET /api/shop/items`: active shop items only
- `POST /api/shop/buy`: buy with `{ "itemId": "..." }`
- `GET /api/shop/cards`: compatibility endpoint for old card shop data
- `POST /api/shop/buy` also accepts `{ "cardId": "..." }` for compatibility

## Match Rewards
When a game ends, `server/game` calls the API internal reward endpoint.

Rewards:
- Winning team member: `+10 coins`, `+1 gem`, `+200 elo`
- Losing team member: `+2 coins`

Internal endpoint:
- `POST /api/internal/matches/reward`
- Header: `x-game-server-secret: <GAME_SERVER_INTERNAL_SECRET>`

## Notes
- This folder is a clean formatted copy of the current merged project.
- Original repository remains untouched.
