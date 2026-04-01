import * as roomService from '../services/roomService.js';
import { SOCKET_EVENTS } from '../../../shared/constants/EVENTS.js';

export function registerRoomHandlers(io, socket) {
  // Tạo phòng mới
  socket.on(SOCKET_EVENTS.CREATE_ROOM, async ({ userId, username, characterId }) => {
    try {
      const room = await roomService.createRoom(userId, username, characterId);

      socket.join(room.roomCode);
      socket.emit(SOCKET_EVENTS.ROOM_UPDATED, { success: true, room });

      console.log(`Room ${room.roomCode} created by ${username}`);
    } catch (err) {
      socket.emit(SOCKET_EVENTS.ROOM_UPDATED, { success: false, error: err.message });
    }
  });
  // Vào phòng
  socket.on(SOCKET_EVENTS.JOIN_ROOM, async ({ roomCode, userId, username, characterId }) => {
    try {
      const room = await roomService.joinRoom(roomCode, userId, username, characterId);

      socket.join(roomCode);

      // Broadcast cho tất cả trong phòng
      io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATED, { success: true, room });

      console.log(`${username} joined room ${roomCode}`);
    } catch (err) {
      socket.emit(SOCKET_EVENTS.ROOM_UPDATED, { success: false, error: err.message });
    }
  });

  // Rời phòng
  socket.on('room:leave', async ({ roomCode, userId }) => {
    try {
      const room = await roomService.leaveRoom(roomCode, userId);
      socket.leave(roomCode);

      if (room) {
        io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATED, { success: true, room });
      }
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // Khi disconnect đột ngột
  socket.on('disconnect', async () => {
    const { roomCode, userId } = socket.data;
    if (roomCode && userId) {
      const room = await roomService.leaveRoom(roomCode, userId);
      if (room) {
        io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATED, { success: true, room });
      }
    }
  });
}
