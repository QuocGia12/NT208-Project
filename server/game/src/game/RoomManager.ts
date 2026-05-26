// ============================================================
// RoomManager - Singleton manager for all active game rooms.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { GameRoom } from './GameRoom';

export class RoomManager {
  public rooms: Map<string, GameRoom>;
  private static instance: RoomManager;

  private constructor() {
    this.rooms = new Map<string, GameRoom>();
  }

  static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  createRoom(io: Server): GameRoom {
    let roomId = uuidv4();
    while (this.rooms.has(roomId)) {
      roomId = uuidv4();
    }

    const room = new GameRoom(roomId, io);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId) ?? null;
  }

  getRoomByJoinCode(code: string): GameRoom | null {
    const normalized = (code || '').trim().toUpperCase();
    for (const room of this.rooms.values()) {
      if (room.joinCode.toUpperCase() === normalized) {
        return room;
      }
    }
    return null;
  }

  getRoomBySocket(socketId: string): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.players.some(player => player.socketId === socketId)) {
        return room;
      }
    }
    return null;
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}
