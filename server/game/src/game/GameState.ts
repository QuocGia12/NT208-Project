// ============================================================
// GameState — Full authoritative state of a game session.
// Server is the single source of truth.
// Test 7: 2v2 team mode with tether mechanics.
// ============================================================

import {
  RoomStatus, Phase, PhaseContext, PublicReveal,
  PublicGameState, PrivateGameState, ZodiacName,
  ALL_ZODIACS, CardType, CellType, MAP, Position,
  PlayerWithTeamInput, TeamInfo, TeamSlotId,
  TETHER_INITIAL_LENGTH, RESPAWN_PENALTY_CELLS,
} from '../types';
import { Board } from './Board';
import { Cell } from './Cell';
import { Card } from './Card';
import { CardDeck } from './CardDeck';
import { Player } from './Player';

export class GameState {
  public roomId: string;
  public status: RoomStatus;

  public board: Board;
  public players: Player[];
  public deck: CardDeck;
  public teams: TeamInfo[];          // Test 7: 2 teams

  public turnOrder: string[];          // [playerId, ...] — T1P1→T2P1→T1P2→T2P2
  public currentPlayerIndex: number;   // index into turnOrder
  public turnNumber: number;

  public currentPhase: Phase;
  public phaseContext: PhaseContext;

  public publicReveal: PublicReveal | null;

  public winner: string | null;        // Test 7: winning teamId
  public eliminatedPlayers: string[];  // kept for compatibility, always empty in Test 7

  public createdAt: number;
  public updatedAt: number;

  private constructor() {
    // Use static create() or fromRedisJSON()
    this.roomId = '';
    this.status = RoomStatus.WAITING;
    this.board = null as unknown as Board;
    this.players = [];
    this.deck = null as unknown as CardDeck;
    this.teams = [];
    this.turnOrder = [];
    this.currentPlayerIndex = 0;
    this.turnNumber = 0;
    this.currentPhase = Phase.DRAW_CARD;
    this.phaseContext = { phase: 0 };
    this.publicReveal = null;
    this.winner = null;
    this.eliminatedPlayers = [];
    this.createdAt = 0;
    this.updatedAt = 0;
  }

  // ─── Static factory ───────────────────────────────────────

  /**
   * Create a new game state for a room.
   * Test 7: 2v2 teams. Assigns 4 players to 2 teams of 2.
   * Turn order: T1P1 → T2P1 → T1P2 → T2P2
   */
  static create(
    roomId: string,
    playerInfos: { id: string; socketId: string; name: string }[],
  ): GameState {
    const gs = new GameState();
    const now = Date.now();

    gs.roomId = roomId;
    gs.status = RoomStatus.PLAYING;

    // 1. Pick 4 random zodiacs from the 12
    const shuffledZodiacs = [...ALL_ZODIACS];
    GameState.fisherYatesShuffle(shuffledZodiacs);
    const activeZodiacs = shuffledZodiacs.slice(0, 4) as ZodiacName[];

    // 2. Shuffle player order for team assignment
    const shuffledInfos = [...playerInfos];
    GameState.fisherYatesShuffle(shuffledInfos);

    // 3. Assign teams: first 2 → team1, last 2 → team2
    const team1Zodiacs = [activeZodiacs[0], activeZodiacs[1]];
    const team2Zodiacs = [activeZodiacs[2], activeZodiacs[3]];

    gs.players = shuffledInfos.map((info, index) => {
      const teamId = index < 2 ? 'team1' : 'team2';
      const zodiac = activeZodiacs[index];
      const turnIndex = index;
      return new Player(info.id, info.socketId, info.name, zodiac, turnIndex, teamId);
    });

    // 4. Set turn order: T1P1 → T2P1 → T1P2 → T2P2
    const t1Players = gs.players.filter(p => p.teamId === 'team1');
    const t2Players = gs.players.filter(p => p.teamId === 'team2');
    gs.turnOrder = [
      t1Players[0].id,
      t2Players[0].id,
      t1Players[1].id,
      t2Players[1].id,
    ];

    // Fix turnIndex to match turnOrder position
    gs.turnOrder.forEach((pid, idx) => {
      const player = gs.players.find(p => p.id === pid)!;
      player.turnIndex = idx;
    });

    // 5. Create team infos
    gs.teams = [
      {
        teamId: 'team1',
        playerIds: t1Players.map(p => p.id),
        zodiacs: team1Zodiacs,
        tetherLength: TETHER_INITIAL_LENGTH,
        totalClaimed: 0,
      },
      {
        teamId: 'team2',
        playerIds: t2Players.map(p => p.id),
        zodiacs: team2Zodiacs,
        tetherLength: TETHER_INITIAL_LENGTH,
        totalClaimed: 0,
      },
    ];

    // 6. Generate board with the active zodiacs
    gs.board = Board.generate(activeZodiacs);

    // 7. Build shuffled dynamic deck
    gs.deck = CardDeck.build(activeZodiacs);

    // 8. Game starts at turn 0, phase 0
    gs.currentPlayerIndex = 0;
    gs.turnNumber = 0;
    gs.currentPhase = Phase.DRAW_CARD;
    gs.phaseContext = { phase: 0 };

    // 9. No reveal, no winner
    gs.publicReveal = null;
    gs.winner = null;
    gs.eliminatedPlayers = [];

    // 10. Timestamps
    gs.createdAt = now;
    gs.updatedAt = now;

    return gs;
  }

  /**
   * Create a game using team/slot assignments provided by matchmaking.
   * This keeps the legacy create() path untouched for debug rooms.
   */
  static createWithTeams(
    roomId: string,
    playersWithTeams: PlayerWithTeamInput[],
  ): GameState {
    if (playersWithTeams.length !== 4) {
      throw new Error('createWithTeams requires exactly 4 players.');
    }

    const teamSlots: TeamSlotId[] = [
      'team1-slot0',
      'team1-slot1',
      'team2-slot0',
      'team2-slot1',
    ];
    const turnSlots: TeamSlotId[] = [
      'team1-slot0',
      'team2-slot0',
      'team1-slot1',
      'team2-slot1',
    ];
    const slotToPlayer = new Map<TeamSlotId, PlayerWithTeamInput>();
    const seenPlayerIds = new Set<string>();

    for (const playerInfo of playersWithTeams) {
      const slotId = GameState.toTeamSlotId(playerInfo.teamId, playerInfo.teamSlot);
      if (!slotId) {
        throw new Error(`Invalid team slot for player ${playerInfo.id}.`);
      }
      if (slotToPlayer.has(slotId)) {
        throw new Error(`Duplicate team slot ${slotId}.`);
      }
      if (seenPlayerIds.has(playerInfo.id)) {
        throw new Error(`Duplicate player id ${playerInfo.id}.`);
      }

      seenPlayerIds.add(playerInfo.id);
      slotToPlayer.set(slotId, playerInfo);
    }

    for (const slotId of teamSlots) {
      if (!slotToPlayer.has(slotId)) {
        throw new Error(`Missing required team slot ${slotId}.`);
      }
    }

    const gs = new GameState();
    const now = Date.now();

    gs.roomId = roomId;
    gs.status = RoomStatus.PLAYING;

    const shuffledZodiacs = [...ALL_ZODIACS];
    GameState.fisherYatesShuffle(shuffledZodiacs);
    const activeZodiacs = shuffledZodiacs.slice(0, 4) as ZodiacName[];

    const zodiacBySlot: Record<TeamSlotId, ZodiacName> = {
      'team1-slot0': activeZodiacs[0],
      'team1-slot1': activeZodiacs[1],
      'team2-slot0': activeZodiacs[2],
      'team2-slot1': activeZodiacs[3],
    };

    gs.players = teamSlots.map((slotId) => {
      const playerInfo = slotToPlayer.get(slotId)!;
      const turnIndex = turnSlots.indexOf(slotId);
      return new Player(
        playerInfo.id,
        playerInfo.socketId,
        playerInfo.name,
        zodiacBySlot[slotId],
        turnIndex,
        playerInfo.teamId,
      );
    });

    gs.turnOrder = turnSlots.map(slotId => slotToPlayer.get(slotId)!.id);

    const team1Players = teamSlots
      .filter(slotId => slotId.startsWith('team1'))
      .map(slotId => slotToPlayer.get(slotId)!);
    const team2Players = teamSlots
      .filter(slotId => slotId.startsWith('team2'))
      .map(slotId => slotToPlayer.get(slotId)!);

    gs.teams = [
      {
        teamId: 'team1',
        playerIds: team1Players.map(p => p.id),
        zodiacs: [zodiacBySlot['team1-slot0'], zodiacBySlot['team1-slot1']],
        tetherLength: TETHER_INITIAL_LENGTH,
        totalClaimed: 0,
      },
      {
        teamId: 'team2',
        playerIds: team2Players.map(p => p.id),
        zodiacs: [zodiacBySlot['team2-slot0'], zodiacBySlot['team2-slot1']],
        tetherLength: TETHER_INITIAL_LENGTH,
        totalClaimed: 0,
      },
    ];

    gs.board = Board.generate(activeZodiacs);
    gs.deck = CardDeck.build(activeZodiacs);
    gs.currentPlayerIndex = 0;
    gs.turnNumber = 0;
    gs.currentPhase = Phase.DRAW_CARD;
    gs.phaseContext = { phase: 0 };
    gs.publicReveal = null;
    gs.winner = null;
    gs.eliminatedPlayers = [];
    gs.createdAt = now;
    gs.updatedAt = now;

    return gs;
  }

  // ─── Player access ────────────────────────────────────────

  /** Get the player whose turn it currently is */
  getCurrentPlayer(): Player {
    const playerId = this.turnOrder[this.currentPlayerIndex];
    return this.getPlayerById(playerId)!;
  }

  /** Find player by id */
  getPlayerById(id: string): Player | undefined {
    return this.players.find(p => p.id === id);
  }

  /** Find player by socket id */
  getPlayerBySocketId(socketId: string): Player | undefined {
    return this.players.find(p => p.socketId === socketId);
  }

  // ─── Team access (Test 7) ─────────────────────────────────

  /** Get team info by teamId */
  getTeam(teamId: string): TeamInfo | undefined {
    return this.teams.find(t => t.teamId === teamId);
  }

  /** Get team info for a given player */
  getTeamForPlayer(playerId: string): TeamInfo | undefined {
    const player = this.getPlayerById(playerId);
    if (!player) return undefined;
    return this.getTeam(player.teamId);
  }

  /** Get the teammate of a given player */
  getTeammate(playerId: string): Player | undefined {
    const team = this.getTeamForPlayer(playerId);
    if (!team) return undefined;
    const teammateId = team.playerIds.find(id => id !== playerId);
    if (!teammateId) return undefined;
    return this.getPlayerById(teammateId);
  }

  // ─── Tether mechanics (Test 7) ────────────────────────────

  /**
   * Calculate tether distance between two positions.
   * Test update:
   * - dx/dy are computed as horizontal/vertical "gaps" (cells between),
   *   not direct player coordinate differences.
   * - gapX = max(|x1 - x2| - 1, 0)
   * - gapY = max(|y1 - y2| - 1, 0)
   * - distance = floor(sqrt(gapX² + gapY²))
   */
  static calculateTetherDistance(posA: Position, posB: Position): number {
    const rawDx = Math.abs(posA.x - posB.x);
    const rawDy = Math.abs(posA.y - posB.y);
    const gapX = rawDx > 0 ? rawDx - 1 : 0;
    const gapY = rawDy > 0 ? rawDy - 1 : 0;

    return Math.floor(Math.sqrt(gapX * gapX + gapY * gapY));
  }

  /**
   * Check if moving a player to targetPosition would violate their tether.
   * Returns true if the move is within tether range.
   */
  isWithinTether(playerId: string, targetPosition: Position): boolean {
    const teammate = this.getTeammate(playerId);
    if (!teammate || !teammate.hasSpawned) return true; // No constraint if teammate hasn't spawned
    
    const team = this.getTeamForPlayer(playerId);
    if (!team) return true;

    const distance = GameState.calculateTetherDistance(targetPosition, teammate.position);
    return distance <= team.tetherLength;
  }

  /**
   * Update tether length after a team claims cells.
   * Tether decreases by 1 for every 2 cells the team claims.
   * Formula: tetherLength = TETHER_INITIAL_LENGTH - floor(totalClaimed / 2) + bonusFromRespawns
   * 
   * We track this more simply: after each claim, recalculate.
   */
  updateTeamAfterClaim(playerId: string): void {
    const team = this.getTeamForPlayer(playerId);
    if (!team) return;

    // Recalculate totalClaimed from actual board state
    let totalClaimed = 0;
    for (const pid of team.playerIds) {
      const player = this.getPlayerById(pid);
      if (player) {
        totalClaimed += player.claimedCount;
      }
    }
    
    const oldClaimed = team.totalClaimed;
    team.totalClaimed = totalClaimed;

    // Check if we crossed a threshold of 2 (from oldClaimed to totalClaimed)
    const oldThreshold = Math.floor(oldClaimed / 2);
    const newThreshold = Math.floor(totalClaimed / 2);
    if (newThreshold > oldThreshold) {
      team.tetherLength = Math.max(1, team.tetherLength - (newThreshold - oldThreshold));
    }
  }

  /**
   * Test 7: Handle player stuck (respawn flow).
   * Returns info about what happened for broadcasting.
   */
  handlePlayerStuck(playerId: string): {
    respawnPosition: Position;
    cellsLost: number;
    newTetherLength: number;
    newTeamClaimed: number;
    claimedOnRespawn: boolean;
  } {
    const player = this.getPlayerById(playerId)!;
    const team = this.getTeamForPlayer(playerId)!;

    // 1. Find team's claimed cells
    const teamClaimedCells: Cell[] = [];
    for (const pid of team.playerIds) {
      const p = this.getPlayerById(pid)!;
      const cells = this.board.getClaimedCellsByPlayer(pid);
      teamClaimedCells.push(...cells);
    }

    // 2. Unclaim up to RESPAWN_PENALTY_CELLS random cells
    let cellsLost = 0;
    if (teamClaimedCells.length > 0) {
      const toUnclaim = Math.min(RESPAWN_PENALTY_CELLS, teamClaimedCells.length);
      GameState.fisherYatesShuffle(teamClaimedCells);
      
      for (let i = 0; i < toUnclaim; i++) {
        const cell = teamClaimedCells[i];
        const owner = this.getPlayerById(cell.claimedBy!)!;
        this.board.unclaimCell(cell.x, cell.y);
        owner.claimedCount -= 1;
        cellsLost++;
      }

      // Only increase tether if we actually lost cells
      if (cellsLost >= RESPAWN_PENALTY_CELLS) {
        team.tetherLength += 1;
      }
    }

    // 3. Recalculate team totalClaimed
    let newTotalClaimed = 0;
    for (const pid of team.playerIds) {
      const p = this.getPlayerById(pid)!;
      newTotalClaimed += p.claimedCount;
    }
    team.totalClaimed = newTotalClaimed;

    // 4. Find respawn position within tether range
    const respawnPos = this.findRespawnPosition(playerId);
    player.position = { x: respawnPos.x, y: respawnPos.y };

    // 5. Auto-claim if respawn lands on own zodiac cell
    let claimedOnRespawn = false;
    if (this.board.tryClaimCell(respawnPos.x, respawnPos.y, player.id, player.zodiac)) {
      player.claimedCount += 1;
      claimedOnRespawn = true;
      this.updateTeamAfterClaim(player.id);
    }

    return {
      respawnPosition: respawnPos,
      cellsLost,
      newTetherLength: team.tetherLength,
      newTeamClaimed: team.totalClaimed,
      claimedOnRespawn,
    };
  }

  /**
   * Find a valid respawn position for a player within tether range of teammate.
   */
  private findRespawnPosition(playerId: string): Position {
    const player = this.getPlayerById(playerId)!;
    const teammate = this.getTeammate(playerId);
    const team = this.getTeamForPlayer(playerId)!;
    
    const occupiedSet = new Set(
      this.getOccupiedPositions(playerId).map(p => `${p.x},${p.y}`)
    );

    const candidates: Position[] = [];
    
    for (let y = 0; y < MAP.ROWS; y++) {
      for (let x = 0; x < MAP.COLS; x++) {
        const cell = this.board.getCell(x, y);
        if (!cell) continue;
        if (cell.type === CellType.WALL) continue;
        if (occupiedSet.has(`${x},${y}`)) continue;
        // Can land on blank, draw, or zodiac (even if claimed by someone else for passability)
        // But let's only allow cells that aren't blocked for this player
        if (cell.isBlockedFor(player.id)) continue;

        const pos = { x, y };
        
        // Check tether constraint
        if (teammate && teammate.hasSpawned) {
          const dist = GameState.calculateTetherDistance(pos, teammate.position);
          if (dist > team.tetherLength) continue;
        }

        candidates.push(pos);
      }
    }

    if (candidates.length === 0) {
      // Fallback: if no valid position within tether, expand search (shouldn't happen in practice)
      for (let y = 0; y < MAP.ROWS; y++) {
        for (let x = 0; x < MAP.COLS; x++) {
          const cell = this.board.getCell(x, y);
          if (!cell || cell.type === CellType.WALL) continue;
          if (occupiedSet.has(`${x},${y}`)) continue;
          if (!cell.isBlockedFor(player.id)) {
            candidates.push({ x, y });
          }
        }
      }
    }

    // Pick random from candidates
    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      return candidates[idx];
    }

    // Absolute fallback (should never happen)
    return { x: MAP.CENTER.x, y: MAP.CENTER.y };
  }

  // ─── Card playability ────────────────────────────────────

  /**
   * Compute which cards in a player's hand can be played right now.
   * Returns array of playable card IDs.
   * Test 7: Includes tether check for movement cards.
   */
  computePlayableCards(playerId: string): string[] {
    const player = this.getPlayerById(playerId);
    if (!player) return [];

    const playable: string[] = [];
    const occupiedByOthers = this.getOccupiedPositions(playerId);
    const teammate = this.getTeammate(playerId);
    const team = this.getTeamForPlayer(playerId);
    
    const teammatePos = (teammate && teammate.hasSpawned) ? teammate.position : null;
    const tetherLen = team ? team.tetherLength : TETHER_INITIAL_LENGTH;

    for (const card of player.hand) {
      if (card.type === CardType.CHANGE_TEAMMATE) {
        const helperIds = this.getValidChangeTeammateHelperCardIds(playerId, card.id);
        if (helperIds.length > 0) {
          playable.push(card.id);
        }
        continue;
      }

      if (card.type === CardType.SWAP_TEAMMATE) {
        if (teammate && teammate.hasSpawned) {
          playable.push(card.id);
        }
        continue;
      }

      const targets = card.getValidTargets(
        player.position, this.board, playerId, player.zodiac,
        occupiedByOthers, teammatePos, tetherLen,
      );
      if (targets.length > 0) {
        playable.push(card.id);
      }
    }
    return playable;
  }

  /**
   * Test 9: Find movement helper cards that can be paired with Change Teammate.
   */
  getValidChangeTeammateHelperCardIds(playerId: string, changeCardId?: string): string[] {
    const player = this.getPlayerById(playerId);
    const teammate = this.getTeammate(playerId);
    if (!player || !teammate || !teammate.hasSpawned) return [];

    const helperIds: string[] = [];
    for (const card of player.hand) {
      if (changeCardId && card.id === changeCardId) continue;
      if (!GameState.isMovementCardType(card.type)) continue;

      const targets = this.getValidChangeTeammateTargets(playerId, card.id);
      if (targets.length > 0) {
        helperIds.push(card.id);
      }
    }

    return helperIds;
  }

  /**
   * Test 9: Compute valid teammate destination cells based on selected helper card.
   * - Base target set is calculated from current player's position using helper card logic.
   * - Then we filter for teammate passability + occupancy + tether (teammate to current player).
   */
  getValidChangeTeammateTargets(playerId: string, helperCardId: string): Position[] {
    const player = this.getPlayerById(playerId);
    const teammate = this.getTeammate(playerId);
    const team = this.getTeamForPlayer(playerId);
    if (!player || !teammate || !teammate.hasSpawned || !team) return [];

    const helperCard = player.getCard(helperCardId);
    if (!helperCard || !GameState.isMovementCardType(helperCard.type)) return [];

    const baseTargets = helperCard.getValidTargets(
      player.position,
      this.board,
      player.id,
      player.zodiac,
      this.getOccupiedPositions(player.id),
      null,
      Number.MAX_SAFE_INTEGER,
    );

    const occupiedForTeammate = new Set(
      this.getOccupiedPositions(teammate.id).map(p => `${p.x},${p.y}`)
    );

    return baseTargets.filter(target => {
      const cell = this.board.getCell(target.x, target.y);
      if (!cell) return false;

      if (occupiedForTeammate.has(`${target.x},${target.y}`)) return false;
      if (cell.isBlockedFor(teammate.id)) return false;

      const tetherDistance = GameState.calculateTetherDistance(target, player.position);
      return tetherDistance <= team.tetherLength;
    });
  }

  /** Update the updatedAt timestamp */
  touch(): void {
    this.updatedAt = Date.now();
  }

  getOccupiedPositions(excludePlayerId?: string): Position[] {
    return this.players
      .filter(player =>
        (!excludePlayerId || player.id !== excludePlayerId)
        && player.hasSpawned
        && !player.eliminated
      )
      .map(player => ({ x: player.position.x, y: player.position.y }));
  }

  // ─── Serialization: Broadcast variants ────────────────────

  /**
   * Public game state — sent to ALL clients.
   * Hides: player hands, deck cards.
   */
  toPublicGameState(): PublicGameState {
    return {
      roomId: this.roomId,
      status: this.status,
      board: this.board.toJSON(),
      players: this.players.map(p => p.toPublicJSON()),
      deck: { remaining: this.deck.getRemaining() },
      teams: this.teams.map(t => ({ ...t })),
      turnOrder: [...this.turnOrder],
      currentPlayerIndex: this.currentPlayerIndex,
      turnNumber: this.turnNumber,
      currentPhase: this.currentPhase,
      phaseContext: { ...this.phaseContext } as PhaseContext,
      publicReveal: this.publicReveal ? { ...this.publicReveal } : null,
      winner: this.winner,
      eliminatedPlayers: [...this.eliminatedPlayers],
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Private game state — sent to a SPECIFIC player.
   * Includes their hand and playable cards on top of public state.
   */
  toPrivateGameState(forPlayerId: string): PrivateGameState {
    const publicState = this.toPublicGameState();
    const player = this.getPlayerById(forPlayerId);

    return {
      ...publicState,
      myHand: player ? player.hand.map(c => c.toJSON()) : [],
      myPlayableCards: this.computePlayableCards(forPlayerId),
    };
  }

  // ─── Serialization: Redis persistence ─────────────────────

  /**
   * Serialize FULL state to JSON string for Redis storage.
   */
  toRedisJSON(): string {
    return JSON.stringify({
      roomId: this.roomId,
      status: this.status,
      board: this.board.toJSON(),
      players: this.players.map(p => p.toPrivateJSON()),
      deck: this.deck.toFullJSON(),
      teams: this.teams,
      turnOrder: this.turnOrder,
      currentPlayerIndex: this.currentPlayerIndex,
      turnNumber: this.turnNumber,
      currentPhase: this.currentPhase,
      phaseContext: this.phaseContext,
      publicReveal: this.publicReveal,
      winner: this.winner,
      eliminatedPlayers: this.eliminatedPlayers,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    });
  }

  /**
   * Reconstruct full GameState from Redis JSON string.
   */
  static fromRedisJSON(json: string): GameState {
    const data = JSON.parse(json);
    const gs = new GameState();

    gs.roomId = data.roomId;
    gs.status = data.status;

    // Rebuild board
    const cells = data.board.cells.map((cs: any) =>
      Object.assign(
        new Cell(cs.x, cs.y, cs.type, cs.zodiac),
        { claimedBy: cs.claimedBy },
      )
    );
    gs.board = new Board(cells, data.board.activeZodiacs);

    // Rebuild deck
    const deckCards = data.deck.cards.map((cs: any) => {
      const card = new Card(cs.type);
      (card as any).id = cs.id;
      return card;
    });
    const discardCards = (data.deck.discardPile ?? []).map((cs: any) => {
      const card = new Card(cs.type);
      (card as any).id = cs.id;
      return card;
    });
    gs.deck = new CardDeck(deckCards, discardCards);

    // Rebuild players
    gs.players = data.players.map((ps: any) => {
      const player = new Player(ps.id, ps.socketId, ps.name, ps.zodiac, ps.turnIndex, ps.teamId || '');
      player.position = { x: ps.position.x, y: ps.position.y };
      player.claimedCount = ps.claimedCount;
      player.eliminated = ps.eliminated;
      player.connected = ps.connected;
      player.hand = ps.hand.map((cs: any) => {
        const card = new Card(cs.type);
        (card as any).id = cs.id;
        return card;
      });
      player.handSize = player.hand.length;
      player.hasSpawned = ps.hasSpawned ?? true;
      player.isLocked = ps.isLocked ?? false;
      player.skipNextTurn = ps.skipNextTurn ?? false;
      return player;
    });

    // Rebuild teams
    gs.teams = data.teams || [];

    // Scalars
    gs.turnOrder = data.turnOrder;
    gs.currentPlayerIndex = data.currentPlayerIndex;
    gs.turnNumber = data.turnNumber;
    gs.currentPhase = data.currentPhase;
    gs.phaseContext = data.phaseContext;
    gs.publicReveal = data.publicReveal;
    gs.winner = data.winner;
    gs.eliminatedPlayers = data.eliminatedPlayers;
    gs.createdAt = data.createdAt;
    gs.updatedAt = data.updatedAt;

    return gs;
  }

  // ─── Utility ──────────────────────────────────────────────

  private static toTeamSlotId(teamId: string, teamSlot: number): TeamSlotId | null {
    const slotId = `${teamId}-slot${teamSlot}`;
    if (
      slotId === 'team1-slot0'
      || slotId === 'team1-slot1'
      || slotId === 'team2-slot0'
      || slotId === 'team2-slot1'
    ) {
      return slotId;
    }
    return null;
  }

  static fisherYatesShuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private static isMovementCardType(type: CardType): boolean {
    return (
      type !== CardType.EXTRA_TURN
      && type !== CardType.CHANGE_TEAMMATE
      && type !== CardType.SWAP_TEAMMATE
    );
  }
}
