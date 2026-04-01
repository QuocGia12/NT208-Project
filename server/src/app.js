// main -> chạy đầu tiên, gọi đến các file khác 

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';
import authRoutes from './api/routes/auth.js';
import { registerRoomHandlers } from './socket/roomHandlers.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);


const io = new Server(httpServer, {
    cors: {
        // Biến origin thành một mảng ([...]) và thêm port 5500 vào
        origin: [
            process.env.CLIENT_URL || 'http://localhost:5173',
            'http://localhost:5500' // <--- Thêm port của file HTML test
        ],
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes); // Đăng ký route auth 

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    registerRoomHandlers(io, socket);


    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;

async function start() {
    await connectDB();
    await connectRedis();
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start();
