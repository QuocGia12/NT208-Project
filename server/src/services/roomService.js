import { redis } from '../config/redis.js';
import Match from '../models/Match.js';

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(userId, username, characterId) {
  const roomCode = generateRoomCode();

  const roomState = {
    roomCode,
    status: 'waiting',
    players: [{
      userId,
      username,
      characterId,
      isReady: false,
      isHost: true
    }],
    maxPlayers: 4,
    createdAt: Date.now()
  };

  // Lưu vào Redis — tự xóa sau 1 tiếng nếu không dùng
  await redis.setex(`room:${roomCode}`, 3600, JSON.stringify(roomState));

  return roomState;
}

export async function joinRoom(roomCode, userId, username, characterId) {
  const raw = await redis.get(`room:${roomCode}`);
  if (!raw) throw new Error('Phòng không tồn tại');

  const room = JSON.parse(raw);

  if (room.status !== 'waiting') throw new Error('Phòng đã bắt đầu');
  if (room.players.length >= room.maxPlayers) throw new Error('Phòng đã đầy');

  const alreadyIn = room.players.find(p => p.userId === userId);
  if (alreadyIn) throw new Error('Bạn đã ở trong phòng này');

  room.players.push({ userId, username, characterId, isReady: false, isHost: false });
  await redis.setex(`room:${roomCode}`, 3600, JSON.stringify(room));

  return room;
}

export async function leaveRoom(roomCode, userId) {
  const raw = await redis.get(`room:${roomCode}`);
  if (!raw) return;
  const room = JSON.parse(raw);
  room.players = room.players.filter(p => p.userId !== userId);

  if (room.players.length === 0) {
    await redis.del(`room:${roomCode}`);
    return null;
  }

  // Nếu host rời, chuyển host cho người tiếp theo
  if (!room.players.find(p => p.isHost)) {
    room.players[0].isHost = true;
  }

  await redis.setex(`room:${roomCode}`, 3600, JSON.stringify(room));
  return room;
}

export async function getRoom(roomCode) {
  const raw = await redis.get(`room:${roomCode}`);
  if (!raw) return null;
  return JSON.parse(raw);
}
