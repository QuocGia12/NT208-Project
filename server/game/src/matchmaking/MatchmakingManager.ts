import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { RoomManager } from '../game/RoomManager';
import {
  ErrorCode,
  MatchFoundPlayerData,
  MatchmakingPartyMode,
  MatchmakingPartyStatus,
  MatchmakingPlayerPayload,
  PartyUpdateData,
  PartyUpdateSlot,
  PlayerWithTeamInput,
  TeamId,
  TeamSlot,
  TeamSlotId,
} from '../types';

type QueuePlayer = MatchmakingPlayerPayload & {
  socketId: string;
};

type MatchPlayer = MatchFoundPlayerData & {
  socketId: string;
};

type PartySlot = {
  slotId: TeamSlotId;
  teamId: TeamId;
  teamSlot: TeamSlot;
  player: QueuePlayer | null;
  ready: boolean;
};

type Party = {
  partyId: string;
  code: string;
  mode: MatchmakingPartyMode;
  status: MatchmakingPartyStatus;
  hostId: string;
  slots: PartySlot[];
};

const PARTY_ROOM_PREFIX = 'party:';

export class MatchmakingManager {
  private static instance: MatchmakingManager | null = null;

  private io: Server;
  private roomManager: RoomManager;
  private soloQueue: QueuePlayer[] = [];
  private party2Queue: string[] = [];
  private activeParties = new Map<string, Party>();
  private partyByCode = new Map<string, string>();
  private socketToParty = new Map<string, string>();

  private constructor(io: Server, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
  }

  static getInstance(io: Server, roomManager: RoomManager): MatchmakingManager {
    if (!MatchmakingManager.instance) {
      MatchmakingManager.instance = new MatchmakingManager(io, roomManager);
      return MatchmakingManager.instance;
    }

    MatchmakingManager.instance.io = io;
    MatchmakingManager.instance.roomManager = roomManager;
    return MatchmakingManager.instance;
  }

  quickJoin(socket: Socket, playerPayload: MatchmakingPlayerPayload): void {
    const player = this.toQueuePlayer(socket, playerPayload);
    this.removePlayerFromQueuesAndParty(socket.id);

    this.soloQueue = this.soloQueue.filter(p => p.socketId !== socket.id && p.id !== player.id);
    this.soloQueue.push(player);
    socket.emit('matchmaking:queue_update', {
      mode: 'quick',
      status: 'queued',
      queueSize: this.soloQueue.length,
    });

    this.tryCreateMatches();
  }

  quickCancel(socket: Socket): void {
    this.removeSoloPlayer(socket.id);
    socket.emit('matchmaking:queue_update', {
      mode: 'quick',
      status: 'cancelled',
      queueSize: this.soloQueue.length,
    });
  }

  createParty(socket: Socket, mode: MatchmakingPartyMode, playerPayload: MatchmakingPlayerPayload): void {
    this.removePlayerFromQueuesAndParty(socket.id);

    const party: Party = {
      partyId: uuidv4(),
      code: this.generateUniqueCode(),
      mode,
      status: 'waiting',
      hostId: playerPayload.id,
      slots: this.createEmptySlots(mode),
    };

    const player = this.toQueuePlayer(socket, playerPayload);
    this.placePlayerInNextSlot(party, player);
    this.activeParties.set(party.partyId, party);
    this.partyByCode.set(party.code, party.partyId);
    this.socketToParty.set(socket.id, party.partyId);
    socket.join(this.getPartyRoom(party.partyId));
    this.emitPartyUpdate(party);
  }

  joinParty(socket: Socket, code: string, playerPayload: MatchmakingPlayerPayload): void {
    const normalizedCode = (code || '').trim().toUpperCase();
    const partyId = this.partyByCode.get(normalizedCode);
    const party = partyId ? this.activeParties.get(partyId) : undefined;
    if (!party || party.status !== 'waiting') {
      this.emitMatchmakingError(socket, 'PARTY_NOT_FOUND', 'Party not found or unavailable.');
      return;
    }

    if (!this.hasEmptySlot(party)) {
      this.emitMatchmakingError(socket, 'PARTY_FULL', 'Party is full.');
      return;
    }

    this.removePlayerFromQueuesAndParty(socket.id);
    const player = this.toQueuePlayer(socket, playerPayload);
    this.placePlayerInNextSlot(party, player);
    this.socketToParty.set(socket.id, party.partyId);
    socket.join(this.getPartyRoom(party.partyId));
    this.emitPartyUpdate(party);
  }

  leaveParty(socket: Socket): void {
    const party = this.getPartyBySocket(socket.id);
    if (!party) return;

    this.removePlayerFromParty(socket.id, party, true);
  }

  switchSlot(socket: Socket, slotId: TeamSlotId): void {
    const party = this.getPartyBySocket(socket.id);
    if (!party || party.status !== 'waiting') {
      this.emitMatchmakingError(socket, 'PARTY_NOT_FOUND', 'Party not found or unavailable.');
      return;
    }

    const targetSlot = party.slots.find(slot => slot.slotId === slotId);
    if (!targetSlot || targetSlot.player) {
      this.emitMatchmakingError(socket, 'PARTY_SLOT_UNAVAILABLE', 'Target slot is not available.');
      return;
    }

    const currentSlot = party.slots.find(slot => slot.player?.socketId === socket.id);
    if (!currentSlot || !currentSlot.player) {
      this.emitMatchmakingError(socket, 'PARTY_NOT_FOUND', 'You are not in this party.');
      return;
    }

    targetSlot.player = currentSlot.player;
    targetSlot.ready = currentSlot.ready;
    currentSlot.player = null;
    currentSlot.ready = false;
    this.emitPartyUpdate(party);
  }

  setReady(socket: Socket, ready: boolean): void {
    const party = this.getPartyBySocket(socket.id);
    if (!party || party.status !== 'waiting') {
      this.emitMatchmakingError(socket, 'PARTY_NOT_FOUND', 'Party not found or unavailable.');
      return;
    }

    const slot = party.slots.find(s => s.player?.socketId === socket.id);
    if (!slot) {
      this.emitMatchmakingError(socket, 'PARTY_NOT_FOUND', 'You are not in this party.');
      return;
    }

    slot.ready = ready;
    this.emitPartyUpdate(party);

    if (party.mode === 'party2' && this.isPartyFull(party) && this.areAllPlayersReady(party)) {
      party.status = 'queued';
      if (!this.party2Queue.includes(party.partyId)) {
        this.party2Queue.push(party.partyId);
      }
      this.emitPartyUpdate(party);
      this.tryCreateMatches();
      return;
    }

    if (party.mode === 'party4' && this.isPartyFull(party) && this.areAllPlayersReady(party)) {
      this.matchParty4(party);
    }
  }

  startPartyQueue(socket: Socket): void {
    const party = this.getPartyBySocket(socket.id);
    if (!party || party.mode !== 'party2' || party.status !== 'waiting') {
      this.emitMatchmakingError(socket, 'PARTY_NOT_FOUND', 'Party 2 is not available.');
      return;
    }

    if (!this.isPartyFull(party)) {
      this.emitMatchmakingError(socket, 'PARTY_NOT_READY', 'Party 2 needs exactly 2 players.');
      return;
    }

    party.status = 'queued';
    if (!this.party2Queue.includes(party.partyId)) {
      this.party2Queue.push(party.partyId);
    }
    this.emitPartyUpdate(party);
    this.tryCreateMatches();
  }

  handleDisconnect(socketId: string): void {
    this.removeSoloPlayer(socketId);

    const party = this.getPartyBySocket(socketId);
    if (party) {
      this.removePlayerFromParty(socketId, party, false);
    }
  }

  private tryCreateMatches(): void {
    let createdMatch = true;

    while (createdMatch) {
      createdMatch = false;
      this.pruneParty2Queue();

      if (this.party2Queue.length >= 2) {
        const firstParty = this.activeParties.get(this.party2Queue.shift()!)!;
        const secondParty = this.activeParties.get(this.party2Queue.shift()!)!;
        this.matchTwoParty2(firstParty, secondParty);
        createdMatch = true;
        continue;
      }

      if (this.party2Queue.length >= 1 && this.soloQueue.length >= 2) {
        const party = this.activeParties.get(this.party2Queue.shift()!)!;
        const solos = this.soloQueue.splice(0, 2);
        this.matchParty2WithSolos(party, solos);
        createdMatch = true;
        continue;
      }

      if (this.soloQueue.length >= 4) {
        const solos = this.soloQueue.splice(0, 4);
        this.matchFourSolos(solos);
        createdMatch = true;
      }
    }
  }

  private matchFourSolos(players: QueuePlayer[]): void {
    const shuffled = [...players];
    this.shuffle(shuffled);

    this.createGameRoomAndNotify([
      this.toMatchPlayer(shuffled[0], 'team1', 0),
      this.toMatchPlayer(shuffled[1], 'team1', 1),
      this.toMatchPlayer(shuffled[2], 'team2', 0),
      this.toMatchPlayer(shuffled[3], 'team2', 1),
    ]);
  }

  private matchTwoParty2(firstParty: Party, secondParty: Party): void {
    const parties = [firstParty, secondParty];
    this.shuffle(parties);

    this.createGameRoomAndNotify([
      ...this.partyPlayersAsTeam(parties[0], 'team1'),
      ...this.partyPlayersAsTeam(parties[1], 'team2'),
    ]);
    this.markPartyMatched(firstParty);
    this.markPartyMatched(secondParty);
  }

  private matchParty2WithSolos(party: Party, solos: QueuePlayer[]): void {
    const partyTeam: TeamId = Math.random() < 0.5 ? 'team1' : 'team2';
    const soloTeam: TeamId = partyTeam === 'team1' ? 'team2' : 'team1';

    this.createGameRoomAndNotify([
      ...this.partyPlayersAsTeam(party, partyTeam),
      this.toMatchPlayer(solos[0], soloTeam, 0),
      this.toMatchPlayer(solos[1], soloTeam, 1),
    ]);
    this.markPartyMatched(party);
  }

  private matchParty4(party: Party): void {
    this.createGameRoomAndNotify(
      party.slots
        .filter(slot => slot.player)
        .map(slot => this.toMatchPlayer(slot.player!, slot.teamId, slot.teamSlot))
    );
    this.markPartyMatched(party);
  }

  private createGameRoomAndNotify(players: MatchPlayer[]): void {
    if (players.length !== 4) return;

    const room = this.roomManager.createRoom(this.io);
    const runtimePlayers = players.map(player => ({
      ...player,
      runtimeId: this.toRuntimePlayerId(player),
    }));
    const gamePlayers: PlayerWithTeamInput[] = runtimePlayers.map(player => ({
      id: player.runtimeId,
      socketId: player.socketId,
      name: player.username,
      avatar: player.avatar,
      elo: player.elo,
      teamId: player.teamId,
      teamSlot: player.teamSlot,
    }));

    try {
      room.startGameWithTeams(gamePlayers);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create game room.';
      for (const player of players) {
        const socket = this.io.sockets.sockets.get(player.socketId);
        if (!socket) continue;
        this.emitMatchmakingError(socket, 'MATCH_CREATE_FAILED', `Failed to create match: ${message}`);
      }
      return;
    }

    for (const player of runtimePlayers) {
      const { runtimeId, socketId: _socketId, ...publicPlayer } = player;
      const publicPlayers = runtimePlayers.map(({ runtimeId: publicRuntimeId, socketId, ...p }) => ({
        ...p,
        id: publicRuntimeId,
      }));
      this.io.to(player.socketId).emit('match:found', {
        roomId: room.id,
        players: publicPlayers,
        yourPlayerId: runtimeId,
      });
    }
  }

  private toRuntimePlayerId(player: MatchPlayer): string {
    return `${player.id}::${player.socketId}`;
  }

  private partyPlayersAsTeam(party: Party, teamId: TeamId): MatchPlayer[] {
    return party.slots
      .filter(slot => slot.player)
      .sort((a, b) => a.teamSlot - b.teamSlot)
      .map(slot => this.toMatchPlayer(slot.player!, teamId, slot.teamSlot));
  }

  private toMatchPlayer(
    player: QueuePlayer,
    teamId: TeamId,
    teamSlot: TeamSlot,
  ): MatchPlayer {
    return {
      id: player.id,
      socketId: player.socketId,
      username: player.username,
      avatar: player.avatar,
      elo: player.elo,
      teamId,
      teamSlot,
      turnSlot: this.getTurnSlot(teamId, teamSlot),
    };
  }

  private getTurnSlot(teamId: TeamId, teamSlot: TeamSlot): 0 | 1 | 2 | 3 {
    if (teamId === 'team1' && teamSlot === 0) return 0;
    if (teamId === 'team2' && teamSlot === 0) return 1;
    if (teamId === 'team1' && teamSlot === 1) return 2;
    return 3;
  }

  private markPartyMatched(party: Party): void {
    party.status = 'matched';
    this.removePartyFromQueue(party.partyId);
    this.emitPartyUpdate(party);
    this.activeParties.delete(party.partyId);
    this.partyByCode.delete(party.code);

    for (const slot of party.slots) {
      if (slot.player) {
        this.socketToParty.delete(slot.player.socketId);
      }
    }
  }

  private removePlayerFromQueuesAndParty(socketId: string): void {
    this.removeSoloPlayer(socketId);
    const party = this.getPartyBySocket(socketId);
    if (party) {
      this.removePlayerFromParty(socketId, party, false);
    }
  }

  private removeSoloPlayer(socketId: string): void {
    this.soloQueue = this.soloQueue.filter(player => player.socketId !== socketId);
  }

  private removePlayerFromParty(socketId: string, party: Party, leaveSocketRoom: boolean): void {
    const slot = party.slots.find(s => s.player?.socketId === socketId);
    if (!slot || !slot.player) return;

    slot.player = null;
    slot.ready = false;
    this.socketToParty.delete(socketId);
    this.removePartyFromQueue(party.partyId);

    if (leaveSocketRoom) {
      const socket = this.io.sockets.sockets.get(socketId);
      socket?.leave(this.getPartyRoom(party.partyId));
    }

    const remainingPlayers = party.slots
      .map(s => s.player)
      .filter((player): player is QueuePlayer => Boolean(player));

    if (remainingPlayers.length === 0) {
      this.activeParties.delete(party.partyId);
      this.partyByCode.delete(party.code);
      return;
    }

    party.status = 'waiting';
    party.hostId = remainingPlayers[0].id;
    this.emitPartyUpdate(party);
  }

  private createEmptySlots(mode: MatchmakingPartyMode): PartySlot[] {
    const slots: PartySlot[] = [
      { slotId: 'team1-slot0', teamId: 'team1', teamSlot: 0, player: null, ready: false },
      { slotId: 'team1-slot1', teamId: 'team1', teamSlot: 1, player: null, ready: false },
    ];

    if (mode === 'party4') {
      slots.push(
        { slotId: 'team2-slot0', teamId: 'team2', teamSlot: 0, player: null, ready: false },
        { slotId: 'team2-slot1', teamId: 'team2', teamSlot: 1, player: null, ready: false },
      );
    }

    return slots;
  }

  private placePlayerInNextSlot(party: Party, player: QueuePlayer): void {
    const nextSlot = party.slots.find(slot => !slot.player);
    if (!nextSlot) {
      throw new Error('No empty party slot available.');
    }

    nextSlot.player = player;
    nextSlot.ready = false;
  }

  private toQueuePlayer(socket: Socket, player: MatchmakingPlayerPayload): QueuePlayer {
    return {
      id: String(player.id),
      socketId: socket.id,
      username: String(player.username || 'Player'),
      avatar: player.avatar ?? null,
      elo: typeof player.elo === 'number' ? player.elo : 1000,
    };
  }

  private toPartyUpdate(party: Party): PartyUpdateData {
    return {
      partyId: party.partyId,
      code: party.code,
      mode: party.mode,
      status: party.status,
      slots: party.slots.map<PartyUpdateSlot>(slot => ({
        slotId: slot.slotId,
        teamId: slot.teamId,
        teamSlot: slot.teamSlot,
        player: slot.player
          ? {
              id: slot.player.id,
              username: slot.player.username,
              avatar: slot.player.avatar,
              elo: slot.player.elo,
              ready: slot.ready,
            }
          : null,
      })),
      hostId: party.hostId,
    };
  }

  private emitPartyUpdate(party: Party): void {
    const update = this.toPartyUpdate(party);
    const deliveredSockets = new Set<string>();

    for (const slot of party.slots) {
      if (!slot.player || deliveredSockets.has(slot.player.socketId)) continue;

      deliveredSockets.add(slot.player.socketId);
      this.io.to(slot.player.socketId).emit('party:update', update);
    }
  }

  private emitMatchmakingError(socket: Socket, code: string, message: string): void {
    socket.emit('game:error', {
      ok: false,
      code: ErrorCode.INVALID_PAYLOAD,
      message,
      context: { matchmakingCode: code },
    });
  }

  private getPartyBySocket(socketId: string): Party | undefined {
    const partyId = this.socketToParty.get(socketId);
    return partyId ? this.activeParties.get(partyId) : undefined;
  }

  private getPartyRoom(partyId: string): string {
    return `${PARTY_ROOM_PREFIX}${partyId}`;
  }

  private hasEmptySlot(party: Party): boolean {
    return party.slots.some(slot => !slot.player);
  }

  private isPartyFull(party: Party): boolean {
    return party.slots.every(slot => Boolean(slot.player));
  }

  private areAllPlayersReady(party: Party): boolean {
    return party.slots.every(slot => Boolean(slot.player) && slot.ready);
  }

  private removePartyFromQueue(partyId: string): void {
    this.party2Queue = this.party2Queue.filter(id => id !== partyId);
  }

  private pruneParty2Queue(): void {
    this.party2Queue = this.party2Queue.filter((partyId) => {
      const party = this.activeParties.get(partyId);
      return Boolean(party && party.mode === 'party2' && party.status === 'queued' && this.isPartyFull(party));
    });
  }

  private generateUniqueCode(): string {
    let code = this.generateCode(4);
    while (this.partyByCode.has(code)) {
      code = this.generateCode(6);
    }
    return code;
  }

  private generateCode(length: number): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
