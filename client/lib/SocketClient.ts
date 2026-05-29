'use client';

import type { Socket } from 'socket.io-client';

import { gameSocketClient } from '@/lib/game-socket-client';
import type { Direction, Position } from '@/types/game';

type SocketCallback = (...args: unknown[]) => void;

export class SocketClient {
  private static instance: SocketClient;
  private explicitRoomId = '';

  private constructor() {}

  static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }

    return SocketClient.instance;
  }

  get myPlayerId(): string {
    return gameSocketClient.myPlayerId;
  }

  set myPlayerId(playerId: string) {
    gameSocketClient.myPlayerId = playerId;
  }

  get myRoomId(): string {
    return this.explicitRoomId || gameSocketClient.currentMatch?.roomId || '';
  }

  set myRoomId(roomId: string) {
    this.explicitRoomId = roomId.trim();
  }

  connect(): void {
    gameSocketClient.connect();
  }

  disconnect(): void {
    gameSocketClient.disconnect();
  }

  isConnected(): boolean {
    return gameSocketClient.isConnected();
  }

  getSocket(): Socket {
    return gameSocketClient.getSocket();
  }

  createRoom(playerName: string): void {
    this.ensureSocket().emit('room:create', { playerName: playerName.trim() });
  }

  joinRoom(roomId: string, playerName: string): void {
    this.ensureSocket().emit('room:join', {
      roomId: roomId.trim(),
      playerName: playerName.trim(),
      playerId: this.myPlayerId || undefined,
    });
  }

  sendReady(): void {
    this.ensureSocket().emit('room:ready', {});
  }

  sendMove(direction: Direction): void {
    this.ensureSocket().emit('player:move', { direction, roomId: this.myRoomId });
  }

  sendPickSpawn(position: Position): void {
    this.ensureSocket().emit('player:pick_spawn', { position, roomId: this.myRoomId });
  }

  sendPlayCard(cardId: string, targetPos?: Position, helperCardId?: string): void {
    const payload: {
      cardId: string;
      roomId?: string;
      targetPos?: Position;
      helperCardId?: string;
    } = { cardId, roomId: this.myRoomId };
    if (targetPos) payload.targetPos = targetPos;
    if (helperCardId) payload.helperCardId = helperCardId;
    this.ensureSocket().emit('player:play_card', payload);
  }

  endCardPhaseNow(): void {
    this.ensureSocket().emit('player:end_card_phase', { roomId: this.myRoomId });
  }

  sendDiscardCards(cardIds: string[]): void {
    this.ensureSocket().emit('player:discard_cards', { cardIds, roomId: this.myRoomId });
  }

  requestState(roomId: string): void {
    this.ensureSocket().emit('player:request_state', { roomId });
  }

  debugFillRoom(): void {
    this.ensureSocket().emit('debug:fill_room');
  }

  on(event: string, callback: SocketCallback): void {
    this.ensureSocket().on(event, callback);
  }

  off(event: string, callback?: SocketCallback): void {
    const socket = gameSocketClient.getSocket();
    if (callback) {
      socket.off(event, callback);
      return;
    }

    socket.off(event);
  }

  private ensureSocket(): Socket {
    return gameSocketClient.connect();
  }
}
