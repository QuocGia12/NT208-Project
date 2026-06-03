// ============================================================
// GameRoom - Represents one game room/session.
// ============================================================

import { Server, Socket } from 'socket.io';
import {
  ALL_ZODIACS,
  Direction,
  ErrorCode,
  PlayerWithTeamInput,
  Position,
  RoomStatus,
} from '../types';
import { Player } from './Player';
import { GameState } from './GameState';
import { TurnEngine } from './TurnEngine';

export class GameRoom {
  public id: string;
  public players: Player[];
  public gameState: GameState | null;
  public turnEngine: TurnEngine | null;
  public io: Server;
  public status: RoomStatus;
  public readyPlayers: Set<string>;
  public joinCode: string;

  constructor(id: string, io: Server) {
    this.id = id;
    this.io = io;
    this.players = [];
    this.gameState = null;
    this.turnEngine = null;
    this.status = RoomStatus.WAITING;
    this.readyPlayers = new Set<string>();
    this.joinCode = GameRoom.generateJoinCode();
  }

  addPlayer(socket: Socket, name: string, playerId?: string): void {
    const normalizedName = (name || '').trim() || 'Player';

    // Reconnect path.
    if (playerId) {
      const existing = this.players.find(p => p.id === playerId);
      if (existing) {
        const oldSocketId = existing.socketId;
        existing.socketId = socket.id;
        existing.connected = true;
        existing.name = normalizedName;

        if (this.status === RoomStatus.WAITING && this.readyPlayers.has(oldSocketId)) {
          this.readyPlayers.delete(oldSocketId);
          this.readyPlayers.add(socket.id);
        }

        socket.join(this.id);
        return;
      }
    }

    if (this.players.length >= 4) {
      throw new Error(ErrorCode.ROOM_FULL);
    }

    const newId = this.players.some(p => p.id === socket.id)
      ? `${socket.id}-${Date.now()}`
      : socket.id;

    // Waiting-room placeholder values. Real zodiac/turn order are assigned by GameState.create().
    const placeholderZodiac = ALL_ZODIACS[this.players.length % ALL_ZODIACS.length];
    const player = new Player(
      newId,
      socket.id,
      normalizedName,
      placeholderZodiac,
      this.players.length
    );

    this.players.push(player);
    socket.join(this.id);
  }

  removePlayer(socketId: string): void {
    if (this.status !== RoomStatus.WAITING) {
      return;
    }

    const index = this.players.findIndex(p => p.socketId === socketId);
    if (index === -1) return;

    const [removed] = this.players.splice(index, 1);
    this.readyPlayers.delete(socketId);
    this.readyPlayers.delete(removed.id);

    // Keep waiting-room turn indexes stable after removal.
    this.players.forEach((p, i) => {
      p.turnIndex = i;
    });
  }

  setReady(socketId: string): void {
    if (this.status !== RoomStatus.WAITING) {
      return;
    }

    const player = this.players.find(p => p.socketId === socketId);
    if (!player) return;

    this.readyPlayers.add(socketId);

    if (this.readyPlayers.size === this.players.length && this.players.length === 4) {
      this.startGame();
    }
  }

  startGame(): void {
    if (this.status === RoomStatus.PLAYING || this.players.length !== 4) {
      return;
    }

    const gameState = GameState.create(
      this.id,
      this.players.map(p => ({ id: p.id, socketId: p.socketId, name: p.name }))
    );

    this.startCreatedGame(gameState);
  }

  startGameWithTeams(playersWithTeams: PlayerWithTeamInput[]): void {
    if (this.status !== RoomStatus.WAITING || playersWithTeams.length !== 4) {
      return;
    }

    for (const playerInfo of playersWithTeams) {
      const socket = this.io.sockets.sockets.get(playerInfo.socketId);
      socket?.join(this.id);
    }

    const gameState = GameState.createWithTeams(this.id, playersWithTeams);
    this.startCreatedGame(gameState);
  }

  private startCreatedGame(gameState: GameState): void {
    this.gameState = gameState;

    // Replace waiting placeholders with authoritative in-game players.
    this.players = this.gameState.players;
    this.readyPlayers.clear();

    this.turnEngine = new TurnEngine(
      this.gameState,
      this.broadcastAll.bind(this),
      this.broadcastPrivate.bind(this)
    );

    this.status = RoomStatus.PLAYING;

    const startsAt = Date.now() + 3000;
    this.broadcastAll('room:game_starting', {
      startsAt,
      players: this.players.map(p => p.toPublicJSON()),
    });

    setTimeout(() => {
      if (this.status !== RoomStatus.PLAYING || !this.gameState || !this.turnEngine) {
        return;
      }

      this.broadcastAll('game:state_update', {
        state: this.gameState.toPublicGameState(),
      });
      this.broadcastAllPrivateUpdates();
      this.turnEngine.startGame();
    }, 3000);
  }

  broadcastAll(event: string, data: any): void {
    this.io.to(this.id).emit(event, { ok: true, data });
  }

  broadcastPrivate(socketId: string, event: string, data: any): void {
    this.io.to(socketId).emit(event, { ok: true, data });
  }

  broadcastAllPrivateUpdates(): void {
    if (!this.gameState) return;

    for (const player of this.gameState.players) {
      const privateState = this.gameState.toPrivateGameState(player.id);
      this.broadcastPrivate(player.socketId, 'game:private_update', {
        playerId: player.id,
        myHand: privateState.myHand,
        myPlayableCards: privateState.myPlayableCards,
      });
    }
  }

  reconnectPlayerSocket(socket: Socket, playerId?: string): Player | null {
    if (!this.gameState) return null;

    const existingSocketPlayer = this.gameState.getPlayerBySocketId(socket.id);
    if (existingSocketPlayer) {
      existingSocketPlayer.connected = true;
      socket.join(this.id);
      return existingSocketPlayer;
    }

    if (!playerId) return null;

    const player = this.gameState.getPlayerById(playerId);
    if (!player) return null;

    const previousSocketId = player.socketId;
    player.socketId = socket.id;
    player.connected = true;
    socket.join(this.id);

    if (previousSocketId !== socket.id) {
      this.broadcastAll('server:player_reconnected', {
        playerId: player.id,
        playerName: player.name,
      });
    }

    return player;
  }

  handleMove(socketId: string, direction: Direction): void {
    if (!this.turnEngine || !this.gameState) {
      this.emitGameError(socketId, ErrorCode.GAME_NOT_STARTED, 'Game has not started yet.');
      return;
    }

    const player = this.gameState.getPlayerBySocketId(socketId);
    if (!player) {
      this.emitGameError(socketId, ErrorCode.ROOM_NOT_IN_ROOM, 'Player is not in this room.');
      return;
    }

    const result = this.turnEngine.handleMove(player.id, direction);
    if (!result.ok) {
      const code = (result.error as ErrorCode) || ErrorCode.INTERNAL_ERROR;
      this.emitGameError(socketId, code, this.errorMessage(code));
    }
  }

  handlePlayCard(
    socketId: string,
    cardId: string,
    targetPos?: Position,
    helperCardId?: string,
  ): void {
    if (!this.turnEngine || !this.gameState) {
      this.emitGameError(socketId, ErrorCode.GAME_NOT_STARTED, 'Game has not started yet.');
      return;
    }

    const player = this.gameState.getPlayerBySocketId(socketId);
    if (!player) {
      this.emitGameError(socketId, ErrorCode.ROOM_NOT_IN_ROOM, 'Player is not in this room.');
      return;
    }

    const result = this.turnEngine.handlePlayCard(player.id, cardId, targetPos, helperCardId);
    if (!result.ok) {
      const code = (result.error as ErrorCode) || ErrorCode.INTERNAL_ERROR;
      this.emitGameError(
        socketId,
        code,
        this.errorMessage(code),
        {
          cardId,
          ...(result.validTargets ? { validTargets: result.validTargets } : {}),
          ...(result.helperCardId ? { helperCardId: result.helperCardId } : {}),
          ...(result.helperCardIds ? { helperCardIds: result.helperCardIds } : {}),
        },
      );
    }
  }

  handleEndCardPhase(socketId: string): void {
    if (!this.turnEngine || !this.gameState) {
      this.emitGameError(socketId, ErrorCode.GAME_NOT_STARTED, 'Game has not started yet.');
      return;
    }

    const player = this.gameState.getPlayerBySocketId(socketId);
    if (!player) {
      this.emitGameError(socketId, ErrorCode.ROOM_NOT_IN_ROOM, 'Player is not in this room.');
      return;
    }

    const result = this.turnEngine.handleEndCardPhase(player.id);
    if (!result.ok) {
      const code = (result.error as ErrorCode) || ErrorCode.INTERNAL_ERROR;
      this.emitGameError(socketId, code, this.errorMessage(code));
    }
  }

  handleDiscardCards(socketId: string, cardIds: string[]): void {
    if (!this.turnEngine || !this.gameState) {
      this.emitGameError(socketId, ErrorCode.GAME_NOT_STARTED, 'Game has not started yet.');
      return;
    }

    const player = this.gameState.getPlayerBySocketId(socketId);
    if (!player) {
      this.emitGameError(socketId, ErrorCode.ROOM_NOT_IN_ROOM, 'Player is not in this room.');
      return;
    }

    const result = this.turnEngine.handleDiscardCards(player.id, cardIds);
    if (!result.ok) {
      const code = (result.error as ErrorCode) || ErrorCode.INTERNAL_ERROR;
      this.emitGameError(socketId, code, this.errorMessage(code));
    }
  }

  handlePickSpawn(socketId: string, position: Position): void {
    if (!this.turnEngine || !this.gameState) {
      this.emitGameError(socketId, ErrorCode.GAME_NOT_STARTED, 'Game has not started yet.');
      return;
    }

    const player = this.gameState.getPlayerBySocketId(socketId);
    if (!player) {
      this.emitGameError(socketId, ErrorCode.ROOM_NOT_IN_ROOM, 'Player is not in this room.');
      return;
    }

    const result = this.turnEngine.handlePickSpawn(player.id, position);
    if (!result.ok) {
      const code = (result.error as ErrorCode) || ErrorCode.INTERNAL_ERROR;
      this.emitGameError(
        socketId,
        code,
        this.errorMessage(code),
        code === ErrorCode.NOT_YOUR_TURN ? this.getTurnErrorContext(player.id) : undefined,
      );
    }
  }

  handleRequestState(socket: Socket, playerId?: string): void {
    if (!this.gameState) {
      this.emitGameError(socket.id, ErrorCode.GAME_NOT_STARTED, 'Game has not started yet.');
      return;
    }

    this.reconnectPlayerSocket(socket, playerId);

    socket.emit('game:state_update', {
      ok: true,
      data: { state: this.gameState.toPublicGameState() },
    });

    const player = this.gameState.getPlayerBySocketId(socket.id);
    if (!player) {
      this.emitGameError(socket.id, ErrorCode.ROOM_NOT_IN_ROOM, 'Player is not in this room.');
      return;
    }

    const privateState = this.gameState.toPrivateGameState(player.id);
    socket.emit('game:private_update', {
      ok: true,
      data: {
        playerId: player.id,
        myHand: privateState.myHand,
        myPlayableCards: privateState.myPlayableCards,
      },
    });
  }

  private emitGameError(
    socketId: string,
    code: ErrorCode,
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.io.to(socketId).emit('game:error', {
      ok: false,
      code,
      message,
      context,
    });
  }

  private errorMessage(code: ErrorCode): string {
    const map: Record<ErrorCode, string> = {
      [ErrorCode.ROOM_NOT_FOUND]: 'Room not found.',
      [ErrorCode.ROOM_FULL]: 'Room is full.',
      [ErrorCode.ROOM_GAME_STARTED]: 'Game already started.',
      [ErrorCode.ROOM_NOT_IN_ROOM]: 'You are not in this room.',
      [ErrorCode.NOT_YOUR_TURN]: 'It is not your turn.',
      [ErrorCode.WRONG_PHASE]: 'Action is not allowed in current phase.',
      [ErrorCode.GAME_NOT_STARTED]: 'Game has not started.',
      [ErrorCode.GAME_ALREADY_OVER]: 'Game is already over.',
      [ErrorCode.INVALID_DIRECTION]: 'Invalid movement direction.',
      [ErrorCode.MOVE_OUT_OF_BOUNDS]: 'Move is out of bounds.',
      [ErrorCode.MOVE_BLOCKED]: 'Move is blocked.',
      [ErrorCode.TETHER_VIOLATION]: 'Move violates tether constraint.',
      [ErrorCode.CARD_NOT_IN_HAND]: 'Card not found in your hand.',
      [ErrorCode.CARD_NOT_PLAYABLE]: 'Card is not playable right now.',
      [ErrorCode.CARD_INVALID_TARGET]: 'Card target is invalid.',
      [ErrorCode.CARD_TARGET_REQUIRED]: 'Card target is required.',
      [ErrorCode.CARD_TARGET_NOT_NEEDED]: 'Card target should not be provided.',
      [ErrorCode.CARD_LINKED_CARD_REQUIRED]: 'This card requires choosing one movement card.',
      [ErrorCode.CARD_LINKED_CARD_INVALID]: 'Selected movement card is invalid for this action.',
      [ErrorCode.INTERNAL_ERROR]: 'Internal server error.',
      [ErrorCode.INVALID_PAYLOAD]: 'Invalid payload.',
    };

    return map[code] ?? 'Unknown error.';
  }

  private getTurnErrorContext(socketPlayerId: string): Record<string, unknown> | undefined {
    if (!this.gameState) return undefined;

    const currentPlayer = this.gameState.getCurrentPlayer();
    return {
      roomId: this.id,
      socketPlayerId,
      currentPlayerId: currentPlayer.id,
      currentPlayerName: currentPlayer.name,
      currentPlayerIndex: this.gameState.currentPlayerIndex,
      currentPhase: this.gameState.currentPhase,
      turnOrder: [...this.gameState.turnOrder],
    };
  }

  private static generateJoinCode(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }
}
