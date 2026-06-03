// ============================================================
// SocketHandler - Wires Socket.IO events to room/game logic.
// ============================================================

import { Server, Socket } from 'socket.io';
import type { GameRoom } from '../game/GameRoom';
import {
  ALL_ZODIACS,
  Direction,
  ErrorCode,
  MatchmakingPartyMode,
  MatchmakingPlayerPayload,
  Position,
  RoomStatus,
  TeamSlotId,
} from '../types';
import { Player } from '../game/Player';
import { RoomManager } from '../game/RoomManager';
import { MatchmakingManager } from '../matchmaking/MatchmakingManager';

function unwrapPayload<T>(payload: T | { data: T } | undefined): T | null {
  if (!payload) return null;
  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function emitError(
  socket: Socket,
  code: ErrorCode,
  message: string,
  context?: Record<string, unknown>
): void {
  socket.emit('game:error', {
    ok: false,
    code,
    message,
    context,
  });
}

function isPlayerPayload(player: unknown): player is MatchmakingPlayerPayload {
  if (!player || typeof player !== 'object') return false;
  const candidate = player as Partial<MatchmakingPlayerPayload>;
  return (
    typeof candidate.id === 'string'
    && typeof candidate.username === 'string'
    && (candidate.avatar === null || candidate.avatar === undefined || typeof candidate.avatar === 'string')
    && typeof candidate.elo === 'number'
  );
}

function isPartyMode(mode: unknown): mode is MatchmakingPartyMode {
  return mode === 'party2' || mode === 'party4';
}

function isTeamSlotId(slotId: unknown): slotId is TeamSlotId {
  return (
    slotId === 'team1-slot0'
    || slotId === 'team1-slot1'
    || slotId === 'team2-slot0'
    || slotId === 'team2-slot1'
  );
}

function resolveGameplayRoom(
  roomManager: RoomManager,
  socket: Socket,
  roomId: unknown,
  playerId?: unknown,
): GameRoom | null {
  if (typeof roomId === 'string' && roomId.trim().length > 0) {
    const room = roomManager.getRoom(roomId.trim());
    if (!room) {
      emitError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found.');
      return null;
    }

    if (typeof playerId === 'string' && playerId.trim().length > 0) {
      const player = room.reconnectPlayerSocket(socket, playerId.trim());
      if (!player) {
        emitError(socket, ErrorCode.ROOM_NOT_IN_ROOM, 'Player is not in this room.');
        return null;
      }
    }

    return room;
  }

  const room = roomManager.getRoomBySocket(socket.id);
  if (!room) {
    emitError(socket, ErrorCode.ROOM_NOT_IN_ROOM, 'You are not in any room.');
    return null;
  }

  return room;
}

export function setupSocketHandler(io: Server): void {
  const roomManager = RoomManager.getInstance();
  const matchmakingManager = MatchmakingManager.getInstance(io, roomManager);

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // -------- MATCHMAKING EVENTS --------

    socket.on('matchmaking:quick_join', (payload: any) => {
      const data = unwrapPayload<{ player: MatchmakingPlayerPayload; authToken?: string }>(payload);
      if (!data || !isPlayerPayload(data.player)) {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid matchmaking:quick_join payload.');
        return;
      }

      // TODO(production): verify data.authToken with the UI backend before trusting player identity.
      matchmakingManager.quickJoin(socket, data.player);
    });

    socket.on('matchmaking:quick_cancel', () => {
      matchmakingManager.quickCancel(socket);
    });

    socket.on('party:create', (payload: any) => {
      const data = unwrapPayload<{
        mode: MatchmakingPartyMode;
        player: MatchmakingPlayerPayload;
        authToken?: string;
      }>(payload);
      if (!data || !isPartyMode(data.mode) || !isPlayerPayload(data.player)) {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid party:create payload.');
        return;
      }

      // TODO(production): verify data.authToken with the UI backend before trusting player identity.
      matchmakingManager.createParty(socket, data.mode, data.player);
    });

    socket.on('party:join', (payload: any) => {
      const data = unwrapPayload<{
        code: string;
        player: MatchmakingPlayerPayload;
        authToken?: string;
      }>(payload);
      if (!data || typeof data.code !== 'string' || !isPlayerPayload(data.player)) {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid party:join payload.');
        return;
      }

      // TODO(production): verify data.authToken with the UI backend before trusting player identity.
      matchmakingManager.joinParty(socket, data.code, data.player);
    });

    socket.on('party:leave', () => {
      matchmakingManager.leaveParty(socket);
    });

    socket.on('party:switch_slot', (payload: any) => {
      const data = unwrapPayload<{ slotId: TeamSlotId }>(payload);
      if (!data || !isTeamSlotId(data.slotId)) {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid party:switch_slot payload.');
        return;
      }

      matchmakingManager.switchSlot(socket, data.slotId);
    });

    socket.on('party:ready', (payload: any) => {
      const data = unwrapPayload<{ ready: boolean }>(payload);
      if (!data || typeof data.ready !== 'boolean') {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid party:ready payload.');
        return;
      }

      matchmakingManager.setReady(socket, data.ready);
    });

    socket.on('party:start_queue', () => {
      matchmakingManager.startPartyQueue(socket);
    });

    // -------- ROOM EVENTS --------

    socket.on('room:create', (payload: any) => {
      const data = unwrapPayload<{ playerName: string }>(payload);
      if (!data || typeof data.playerName !== 'string') {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid room:create payload.');
        return;
      }

      const room = roomManager.createRoom(io);
      room.addPlayer(socket, data.playerName);

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        emitError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to create player in room.');
        return;
      }

      socket.emit('room:created', {
        ok: true,
        data: {
          roomId: room.id,
          joinCode: room.joinCode,
        },
      });

      socket.emit('room:joined', {
        ok: true,
        data: {
          roomId: room.id,
          yourPlayerId: player.id,
          yourTurnIndex: player.turnIndex,
          currentPlayers: room.players.map(p => p.toPublicJSON()),
          status: room.status,
        },
      });
    });

    socket.on('room:join', (payload: any) => {
      const data = unwrapPayload<{ roomId: string; playerName: string; playerId?: string }>(payload);
      if (!data || typeof data.roomId !== 'string' || typeof data.playerName !== 'string') {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid room:join payload.');
        return;
      }

      const room = roomManager.getRoom(data.roomId) || roomManager.getRoomByJoinCode(data.roomId);
      if (!room) {
        emitError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found.');
        return;
      }

      const isReconnect = Boolean(data.playerId && room.players.some(p => p.id === data.playerId));

      if (room.status === RoomStatus.PLAYING && !isReconnect) {
        emitError(socket, ErrorCode.ROOM_GAME_STARTED, 'Game already started.');
        return;
      }

      if (!isReconnect && room.players.length >= 4) {
        emitError(socket, ErrorCode.ROOM_FULL, 'Room is full.');
        return;
      }

      try {
        room.addPlayer(socket, data.playerName, data.playerId);
      } catch (err) {
        if (err instanceof Error && err.message === ErrorCode.ROOM_FULL) {
          emitError(socket, ErrorCode.ROOM_FULL, 'Room is full.');
          return;
        }
        emitError(socket, ErrorCode.INTERNAL_ERROR, 'Unable to join room.');
        return;
      }

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        emitError(socket, ErrorCode.INTERNAL_ERROR, 'Failed to join room.');
        return;
      }

      socket.emit('room:joined', {
        ok: true,
        data: {
          roomId: room.id,
          yourPlayerId: player.id,
          yourTurnIndex: player.turnIndex,
          currentPlayers: room.players.map(p => p.toPublicJSON()),
          status: room.status,
        },
      });

      socket.to(room.id).emit('room:player_joined', {
        ok: true,
        data: {
          player: player.toPublicJSON(),
          totalPlayers: room.players.length,
        },
      });

      if (isReconnect && room.status === RoomStatus.PLAYING) {
        room.broadcastAll('server:player_reconnected', {
          playerId: player.id,
          playerName: player.name,
        });
        room.handleRequestState(socket);
      }
    });

    socket.on('room:leave', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) {
        emitError(socket, ErrorCode.ROOM_NOT_IN_ROOM, 'You are not in any room.');
        return;
      }

      if (room.status !== RoomStatus.WAITING) {
        emitError(socket, ErrorCode.ROOM_GAME_STARTED, 'Cannot leave after game started.');
        return;
      }

      const leavingPlayer = room.players.find(p => p.socketId === socket.id);
      room.removePlayer(socket.id);
      socket.leave(room.id);

      if (leavingPlayer) {
        room.broadcastAll('room:player_left', {
          playerId: leavingPlayer.id,
          playerName: leavingPlayer.name,
          totalPlayers: room.players.length,
        });
      }

      if (room.players.length === 0) {
        roomManager.deleteRoom(room.id);
      }
    });

    socket.on('room:ready', () => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) {
        emitError(socket, ErrorCode.ROOM_NOT_IN_ROOM, 'You are not in any room.');
        return;
      }

      room.setReady(socket.id);
    });

    // Development helper: fill room with bots for solo testing.
    socket.on('debug:fill_room', () => {
      if (process.env.NODE_ENV === 'production') {
        emitError(socket, ErrorCode.INTERNAL_ERROR, 'debug:fill_room disabled in production.');
        return;
      }

      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) {
        emitError(socket, ErrorCode.ROOM_NOT_IN_ROOM, 'You are not in any room.');
        return;
      }

      if (room.status !== RoomStatus.WAITING) {
        emitError(socket, ErrorCode.ROOM_GAME_STARTED, 'Game already started.');
        return;
      }

      const botTemplates = [
        { id: 'bot-1', socketId: 'bot-1', name: 'Bot 1' },
        { id: 'bot-2', socketId: 'bot-2', name: 'Bot 2' },
        { id: 'bot-3', socketId: 'bot-3', name: 'Bot 3' },
      ];

      for (const [index, botTemplate] of botTemplates.entries()) {
        if (room.players.length >= 4) break;
        if (room.players.some(player => player.id === botTemplate.id)) continue;

        const bot = new Player(
          botTemplate.id,
          botTemplate.socketId,
          botTemplate.name,
          ALL_ZODIACS[(room.players.length + index) % ALL_ZODIACS.length],
          room.players.length
        );

        room.players.push(bot);

        room.broadcastAll('room:player_joined', {
          player: bot.toPublicJSON(),
          totalPlayers: room.players.length,
        });
      }

      room.readyPlayers.add(socket.id);
      for (const p of room.players) {
        if (p.id.startsWith('bot-')) {
          room.readyPlayers.add(p.socketId);
        }
      }

      if (room.readyPlayers.size === room.players.length && room.players.length === 4) {
        room.startGame();
      }
    });

    // -------- GAME EVENTS --------

    socket.on('player:move', (payload: any) => {
      const data = unwrapPayload<{ direction: Direction; roomId?: string; playerId?: string }>(payload);
      if (!data || typeof data.direction !== 'string') {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid player:move payload.');
        return;
      }

      const room = resolveGameplayRoom(roomManager, socket, data.roomId, data.playerId);
      if (!room) return;

      room.handleMove(socket.id, data.direction);
    });

    socket.on('player:pick_spawn', (payload: any) => {
      const data = unwrapPayload<{ position: Position; roomId?: string; playerId?: string }>(payload);
      if (!data || !data.position || typeof data.position.x !== 'number' || typeof data.position.y !== 'number') {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid player:pick_spawn payload.');
        return;
      }

      const room = resolveGameplayRoom(roomManager, socket, data.roomId, data.playerId);
      if (!room) return;

      room.handlePickSpawn(socket.id, data.position);
    });

    socket.on('player:play_card', (payload: any) => {
      const data = unwrapPayload<{
        cardId: string;
        roomId?: string;
        playerId?: string;
        targetPos?: Position;
        helperCardId?: string;
      }>(payload);
      if (
        !data
        || typeof data.cardId !== 'string'
        || (data.helperCardId !== undefined && typeof data.helperCardId !== 'string')
      ) {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid player:play_card payload.');
        return;
      }

      const room = resolveGameplayRoom(roomManager, socket, data.roomId, data.playerId);
      if (!room) return;

      room.handlePlayCard(socket.id, data.cardId, data.targetPos, data.helperCardId);
    });

    socket.on('player:end_card_phase', (payload: any) => {
      const data = unwrapPayload<{ roomId?: string; playerId?: string }>(payload) ?? {};
      const room = resolveGameplayRoom(roomManager, socket, data.roomId, data.playerId);
      if (!room) return;

      room.handleEndCardPhase(socket.id);
    });

    socket.on('player:discard_cards', (payload: any) => {
      const data = unwrapPayload<{ cardIds: string[]; roomId?: string; playerId?: string }>(payload);
      if (
        !data
        || !Array.isArray(data.cardIds)
        || !data.cardIds.every(cardId => typeof cardId === 'string')
      ) {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid player:discard_cards payload.');
        return;
      }

      const room = resolveGameplayRoom(roomManager, socket, data.roomId, data.playerId);
      if (!room) return;

      room.handleDiscardCards(socket.id, data.cardIds);
    });

    socket.on('player:request_state', (payload: any) => {
      const data = unwrapPayload<{ roomId: string; playerId?: string }>(payload);
      if (!data || typeof data.roomId !== 'string') {
        emitError(socket, ErrorCode.INVALID_PAYLOAD, 'Invalid player:request_state payload.');
        return;
      }

      const room = roomManager.getRoom(data.roomId);
      if (!room) {
        emitError(socket, ErrorCode.ROOM_NOT_FOUND, 'Room not found.');
        return;
      }

      room.handleRequestState(socket, data.playerId);
    });

    // -------- DISCONNECT --------

    socket.on('disconnect', () => {
      matchmakingManager.handleDisconnect(socket.id);

      const room = roomManager.getRoomBySocket(socket.id);
      if (!room) return;

      if (room.status === RoomStatus.WAITING) {
        const leavingPlayer = room.players.find(p => p.socketId === socket.id);
        room.removePlayer(socket.id);

        if (leavingPlayer) {
          room.broadcastAll('room:player_left', {
            playerId: leavingPlayer.id,
            playerName: leavingPlayer.name,
            totalPlayers: room.players.length,
          });
        }

        if (room.players.length === 0) {
          roomManager.deleteRoom(room.id);
        }
      } else {
        const player = room.gameState?.getPlayerBySocketId(socket.id);
        if (player) {
          player.connected = false;
          room.broadcastAll('server:player_disconnected', {
            playerId: player.id,
            playerName: player.name,
          });
        }
      }
    });
  });
}
