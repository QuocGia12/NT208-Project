import type { Server as HttpServer } from 'http';

import jwt from 'jsonwebtoken';
import { Server as SocketIOServer, type Socket } from 'socket.io';

type JwtPayload = {
  sub: string;
  username: string;
};

type SocketUser = {
  userId: string;
  username: string;
};

const jwtSecret = process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me';

const isString = (value: unknown): value is string => typeof value === 'string';

const extractToken = (socket: Socket): string | null => {
  const authToken = socket.handshake.auth?.token;

  if (isString(authToken) && authToken.trim().length > 0) {
    return authToken.trim();
  }

  const authorizationHeader = socket.handshake.headers.authorization;

  if (
    isString(authorizationHeader) &&
    authorizationHeader.startsWith('Bearer ')
  ) {
    return authorizationHeader.slice(7).trim();
  }

  return null;
};

export const initializeSocketServer = (
  httpServer: HttpServer,
  frontendOrigin: string
) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: frontendOrigin,
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = extractToken(socket);

    if (!token) {
      next(new Error('Missing auth token.'));
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      (socket.data as { user?: SocketUser }).user = {
        userId: decoded.sub,
        username: decoded.username
      };

      next();
    } catch {
      next(new Error('Invalid or expired auth token.'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket.data as { user: SocketUser }).user;

    console.log(
      `Socket connected: ${socket.id} (user=${user.username}, id=${user.userId})`
    );

    socket.emit('socket_ready', {
      socketId: socket.id,
      userId: user.userId,
      username: user.username
    });

    socket.on('join_queue', () => {
      socket.join('matchmaking:default');

      socket.emit('queue_joined', {
        queuedAt: Date.now()
      });
    });

    socket.on('leave_queue', () => {
      socket.leave('matchmaking:default');
      socket.emit('queue_left');
    });

    socket.on('join_room', (payload: { roomId?: string } | undefined) => {
      const roomId = payload?.roomId;

      if (!isString(roomId) || roomId.trim().length === 0) {
        socket.emit('room_error', { error: 'roomId is required.' });
        return;
      }

      const normalizedRoomId = roomId.trim();

      socket.join(normalizedRoomId);
      socket.emit('room_joined', { roomId: normalizedRoomId });

      socket.to(normalizedRoomId).emit('room_peer_joined', {
        roomId: normalizedRoomId,
        userId: user.userId,
        username: user.username
      });
    });

    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};
