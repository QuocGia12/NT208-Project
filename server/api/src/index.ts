import dotenv from 'dotenv';

dotenv.config();

import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import authRouter from './routes/auth.routes';
import chatRouter from './routes/chat.routes';
import friendRouter from './routes/friend.routes';
import shopRouter from './routes/shop.routes';
import userRouter from './routes/user.routes';
import { initializeSocketServer } from './socket/server';

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';

app.use(
  cors({
    origin: frontendOrigin
  })
);
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/friends', friendRouter);
app.use('/api/chat', chatRouter);
app.use('/api/shop', shopRouter);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

initializeSocketServer(httpServer, frontendOrigin);

httpServer.listen(port, () => {
  console.log(`Backend server + socket started on port ${port}`);
});
