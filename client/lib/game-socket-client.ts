'use client';

import { io, type Socket } from 'socket.io-client';

export type GameTeamId = 'team1' | 'team2';
export type GameTeamSlot = 0 | 1;
export type GameTeamSlotId =
  | 'team1-slot0'
  | 'team1-slot1'
  | 'team2-slot0'
  | 'team2-slot1';

export type GamePartyMode = 'party2' | 'party4';
export type GamePartyStatus = 'waiting' | 'queued' | 'matched';
export type GameQueueStatus = 'queued' | 'cancelled';

export type GameMatchmakingPlayer = {
  id: string;
  username: string;
  avatar: string | null;
  elo: number;
};

export type GamePartySlot = {
  slotId: GameTeamSlotId;
  teamId: GameTeamId;
  teamSlot: GameTeamSlot;
  player: (GameMatchmakingPlayer & { ready: boolean }) | null;
};

export type GamePartyUpdate = {
  partyId: string;
  code: string;
  mode: GamePartyMode;
  status: GamePartyStatus;
  slots: GamePartySlot[];
  hostId: string;
};

export type GameQueueUpdate = {
  mode: 'quick';
  status: GameQueueStatus;
  queueSize?: number;
};

export type GameMatchFoundPlayer = GameMatchmakingPlayer & {
  teamId: GameTeamId;
  teamSlot: GameTeamSlot;
  turnSlot: 0 | 1 | 2 | 3;
};

export type GameMatchFound = {
  roomId: string;
  players: GameMatchFoundPlayer[];
  yourPlayerId: string;
};

export type GameSocketError = {
  ok?: false;
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

type MaybeWrapped<T> = T | { data: T };
type Unsubscribe = () => void;

const MATCH_STORAGE_KEY = 'zodiac:last-match-found';

const resolveGameSocketUrl = () =>
  process.env.NEXT_PUBLIC_GAME_SOCKET_URL ??
  process.env.NEXT_PUBLIC_GAME_SERVER_URL ??
  'http://localhost:3001';

const unwrapPayload = <T>(payload: MaybeWrapped<T>): T => {
  if (
    payload
    && typeof payload === 'object'
    && 'data' in payload
    && (payload as { data?: T }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
};

class GameSocketClient {
  private socket: Socket | null = null;
  private storageHydrated = false;

  myPlayerId = '';
  currentParty: GamePartyUpdate | null = null;
  currentMatch: GameMatchFound | null = null;

  connect(): Socket {
    this.hydrateFromStorage();
    const socket = this.ensureSocket();

    if (!socket.connected) {
      socket.connect();
    }

    return socket;
  }

  disconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  getSocket(): Socket {
    this.hydrateFromStorage();
    return this.ensureSocket();
  }

  hydrateFromStorage(): GameMatchFound | null {
    if (this.storageHydrated || typeof window === 'undefined') {
      return this.currentMatch;
    }

    this.storageHydrated = true;

    try {
      const raw = window.localStorage.getItem(MATCH_STORAGE_KEY);
      if (!raw) return this.currentMatch;

      const match = JSON.parse(raw) as Partial<GameMatchFound>;
      if (!this.isValidMatch(match)) {
        window.localStorage.removeItem(MATCH_STORAGE_KEY);
        return this.currentMatch;
      }

      this.currentMatch = match;
      this.myPlayerId = match.yourPlayerId;
      return this.currentMatch;
    } catch {
      window.localStorage.removeItem(MATCH_STORAGE_KEY);
      return this.currentMatch;
    }
  }

  getMatchForRoom(roomId: string): GameMatchFound | null {
    const match = this.currentMatch ?? this.hydrateFromStorage();
    return match?.roomId === roomId ? match : null;
  }

  rememberMatch(match: GameMatchFound): void {
    this.currentMatch = match;
    this.myPlayerId = match.yourPlayerId;
    this.currentParty = null;

    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(match));
    } catch {
      // Storage can be unavailable in private modes; in-memory context still works.
    }
  }

  quickJoin(player: GameMatchmakingPlayer, authToken?: string): void {
    this.myPlayerId = player.id;
    this.connect().emit('matchmaking:quick_join', { player, authToken });
  }

  quickCancel(): void {
    this.connect().emit('matchmaking:quick_cancel');
  }

  createParty(mode: GamePartyMode, player: GameMatchmakingPlayer, authToken?: string): void {
    this.myPlayerId = player.id;
    this.currentParty = null;
    this.currentMatch = null;
    this.connect().emit('party:create', { mode, player, authToken });
  }

  joinParty(code: string, player: GameMatchmakingPlayer, authToken?: string): void {
    this.myPlayerId = player.id;
    this.currentParty = null;
    this.currentMatch = null;
    this.connect().emit('party:join', { code, player, authToken });
  }

  leaveParty(): void {
    this.connect().emit('party:leave');
    this.currentParty = null;
  }

  switchSlot(slotId: GameTeamSlotId): void {
    this.connect().emit('party:switch_slot', { slotId });
  }

  setReady(ready: boolean): void {
    this.connect().emit('party:ready', { ready });
  }

  startPartyQueue(): void {
    this.connect().emit('party:start_queue');
  }

  onPartyUpdate(callback: (party: GamePartyUpdate) => void): Unsubscribe {
    const handler = (payload: MaybeWrapped<GamePartyUpdate>) => {
      const party = unwrapPayload(payload);
      this.currentParty = party;
      callback(party);
    };

    return this.on('party:update', handler);
  }

  onQueueUpdate(callback: (queue: GameQueueUpdate) => void): Unsubscribe {
    const handler = (payload: MaybeWrapped<GameQueueUpdate>) => {
      callback(unwrapPayload(payload));
    };

    return this.on('matchmaking:queue_update', handler);
  }

  onMatchFound(callback: (match: GameMatchFound) => void): Unsubscribe {
    const handler = (payload: MaybeWrapped<GameMatchFound>) => {
      const match = unwrapPayload(payload);
      this.rememberMatch(match);
      callback(match);
    };

    return this.on('match:found', handler);
  }

  onError(callback: (error: GameSocketError) => void): Unsubscribe {
    const gameErrorHandler = (payload: MaybeWrapped<GameSocketError>) => {
      callback(unwrapPayload(payload));
    };
    const connectErrorHandler = (error: Error) => {
      callback({
        code: 'CONNECT_ERROR',
        message: `Cannot connect to game server at ${resolveGameSocketUrl()}: ${error.message}`,
      });
    };

    const socket = this.ensureSocket();
    socket.on('game:error', gameErrorHandler);
    socket.on('connect_error', connectErrorHandler);

    return () => {
      socket.off('game:error', gameErrorHandler);
      socket.off('connect_error', connectErrorHandler);
    };
  }

  private ensureSocket(): Socket {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io(resolveGameSocketUrl(), {
      autoConnect: false,
      timeout: 5000,
      transports: ['polling', 'websocket'],
      upgrade: true,
    });

    this.socket.on('party:update', (payload: MaybeWrapped<GamePartyUpdate>) => {
      this.currentParty = unwrapPayload(payload);
    });

    this.socket.on('match:found', (payload: MaybeWrapped<GameMatchFound>) => {
      const match = unwrapPayload(payload);
      this.rememberMatch(match);
    });

    return this.socket;
  }

  private isValidMatch(match: Partial<GameMatchFound>): match is GameMatchFound {
    return (
      typeof match.roomId === 'string'
      && match.roomId.length > 0
      && typeof match.yourPlayerId === 'string'
      && match.yourPlayerId.length > 0
      && Array.isArray(match.players)
    );
  }

  private on<T>(event: string, callback: (payload: MaybeWrapped<T>) => void): Unsubscribe {
    const socket = this.ensureSocket();
    socket.on(event, callback);

    return () => {
      socket.off(event, callback);
    };
  }
}

export const gameSocketClient = new GameSocketClient();

export const connectGameSocket = () => gameSocketClient.connect();
export const disconnectGameSocket = () => gameSocketClient.disconnect();
