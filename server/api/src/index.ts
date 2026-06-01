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

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin: allowedOrigins
  })
);
app.use(express.json({ limit: '8mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
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
