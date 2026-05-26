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
4. `npm run dev`

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
- `npm run db:studio`: open Prisma Studio
- `npm run dev`: start DB, game server, API server, and frontend

## Notes
- This folder is a clean formatted copy of the current merged project.
- Original repository remains untouched.
