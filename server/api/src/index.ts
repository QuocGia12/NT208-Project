import dotenv from 'dotenv';

dotenv.config();

import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import adminShopRouter from './routes/admin-shop.routes';
import authRouter from './routes/auth.routes';
import chatRouter from './routes/chat.routes';
import friendRouter from './routes/friend.routes';
import internalMatchRouter from './routes/internal-match.routes';
import shopRouter from './routes/shop.routes';
import userRouter from './routes/user.routes';
import { getAllowedOrigins } from './config/origins';
import { initializeSocketServer } from './socket/server';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { requestLogger } from './middleware/request-logger.middleware';

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = getAllowedOrigins();

// Khi chạy sau Nginx reverse proxy, cần trust proxy để:
// - req.protocol trả về 'https' (từ X-Forwarded-Proto)
// - req.ip trả về IP thực của client (từ X-Forwarded-For)
app.set('trust proxy', 1);

app.use(requestIdMiddleware);
app.use(express.json({ limit: '32mb' }));
app.use(requestLogger);

app.use(
  cors({
    origin: allowedOrigins
  })
);

// Static uploads: cho phép mọi origin truy cập (ảnh shop, bản đồ là public assets)
// Phaser dùng XHR để load ảnh nên cần CORS header explict, không thể dùng CORS chung với API
app.use('/uploads', cors({ origin: '*' }), express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/friends', friendRouter);
app.use('/api/chat', chatRouter);
app.use('/api/shop', shopRouter);
app.use('/api/admin/shop', adminShopRouter);
app.use('/api/internal/matches', internalMatchRouter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

initializeSocketServer(httpServer, allowedOrigins);

httpServer.listen(port, () => {
  console.log(`Backend server + socket started on port ${port}`);
});
