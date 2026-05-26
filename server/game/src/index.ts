import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { setupSocketHandler } from './socket/SocketHandler';
import { RoomManager } from './game/RoomManager';

const app = express();
const server = http.createServer(app);
const roomManager = RoomManager.getInstance();
const allowedOrigins = (
  process.env.FRONTEND_ORIGINS
  || process.env.FRONTEND_ORIGIN
  || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

setupSocketHandler(io);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: roomManager.rooms.size });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export { io };

