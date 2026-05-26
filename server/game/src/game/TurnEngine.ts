// ============================================================
// TurnEngine - Controls turn lifecycle, phases, and timers.
// Test 7: 2v2 team mode with tether + respawn.
// Flow: [PickSpawn?] -> Phase 0 -> 1 -> 2(card) -> 3(move) -> 4(card) -> next turn.
// Turn order: T1P1 → T2P1 → T1P2 → T2P2
// ============================================================

import {
  CardType,
  CellType,
  Direction,
  ErrorCode,
  Phase,
  Phase1Context,
  Phase2Context,
  Phase3Context,
  PickSpawnContext,
  Position,
  RoomStatus,
  TIMINGS,
  ZodiacName,
} from '../types';
import { GameState } from './GameState';
import { MovementValidator } from './MovementValidator';
import { WinLossChecker } from './WinLossChecker';

type BroadcastFn = (event: string, data: any) => void;
type PrivateFn = (socketId: string, event: string, data: any) => void;
type PlayCardResult = {
  ok: boolean;
  error?: string;
  validTargets?: Position[];
  helperCardId?: string;
  helperCardIds?: string[];
};

export class TurnEngine {
  private static readonly HAND_LIMIT = 4;

  public gameState: GameState;
  public broadcastFn: BroadcastFn;
  public privateFn: PrivateFn;
  public activeTimers: NodeJS.Timeout[];

  private cardPhaseTimer: NodeJS.Timeout | null;
  private discardDecisionTimer: NodeJS.Timeout | null;
  private pendingDiceResult: number;
  private pendingDiscard: {
    playerId: string;
    requiredCount: number;
    expiresAt: number;
    onResolved: (() => void) | null;
  } | null;
  private pausedCardPhase: {
    phaseNumber: 2 | 4;
    remainingMs: number;
  } | null;

  constructor(gameState: GameState, broadcastFn: BroadcastFn, privateFn: PrivateFn) {
    this.gameState = gameState;
    this.broadcastFn = broadcastFn;
    this.privateFn = privateFn;
    this.activeTimers = [];
    this.cardPhaseTimer = null;
    this.discardDecisionTimer = null;
    this.pendingDiceResult = 0;
    this.pendingDiscard = null;
    this.pausedCardPhase = null;
  }

  // ─── Tether helpers ───────────────────────────────────────

  private getTeammatePosition(playerId: string): Position | null {
    const teammate = this.gameState.getTeammate(playerId);
    if (!teammate || !teammate.hasSpawned) return null;
    return teammate.position;
  }

  private getTetherLength(playerId: string): number {
    const team = this.gameState.getTeamForPlayer(playerId);
    return team ? team.tetherLength : 999;
  }

  // ─── Entry ────────────────────────────────────────────────

  startGame(): void {
    if (this.isFinished()) return;
    this.beginTurnForCurrentPlayer();
  }

  private beginTurnForCurrentPlayer(): void {
    if (this.isFinished()) return;
    const currentPlayer = this.gameState.getCurrentPlayer();

    // Next-turn lock: this player's turn is skipped exactly once.
    if (currentPlayer.skipNextTurn) {
      currentPlayer.skipNextTurn = false;
      currentPlayer.isLocked = false;
      this.broadcastState();
      this.endTurn();
      return;
    }

    if (!currentPlayer.hasSpawned) {
      this.startPickSpawn();
    } else {
      this.startPhase0();
    }
  }

  // ─── Pick Spawn (Test 6 + Test 7 tether) ─────────────────

  private startPickSpawn(): void {
    const currentPlayer = this.gameState.getCurrentPlayer();
    const occupiedSet = new Set(
      this.gameState.getOccupiedPositions().map(p => `${p.x},${p.y}`)
    );

    // Test 7: Second player of team is constrained by tether
    const teammatePos = this.getTeammatePosition(currentPlayer.id);
    const tetherLen = this.getTetherLength(currentPlayer.id);

    const available: Position[] = this.gameState.board.getDrawCells()
      .filter(c => !occupiedSet.has(`${c.x},${c.y}`))
      .filter(c => {
        if (!teammatePos) return true; // First player: no constraint
        const dist = GameState.calculateTetherDistance({ x: c.x, y: c.y }, teammatePos);
        return dist <= tetherLen;
      })
      .map(c => ({ x: c.x, y: c.y }));

    const pickSpawnContext: PickSpawnContext = {
      phase: -1,
      availablePositions: available,
    };

    this.gameState.currentPhase = Phase.PICK_SPAWN;
    this.gameState.phaseContext = pickSpawnContext;
    this.broadcastState();

    if (this.isBotTurn() && available.length > 0) {
      this.setManagedTimeout(() => {
        const pick = available[Math.floor(Math.random() * available.length)];
        this.handlePickSpawn(currentPlayer.id, pick);
      }, 400);
    }
  }

  handlePickSpawn(
    playerId: string,
    position: Position,
  ): { ok: boolean; error?: string } {
    if (this.isFinished()) return { ok: false, error: ErrorCode.GAME_ALREADY_OVER };
    if (this.gameState.currentPhase !== Phase.PICK_SPAWN) return { ok: false, error: ErrorCode.WRONG_PHASE };

    const currentPlayer = this.gameState.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return { ok: false, error: ErrorCode.NOT_YOUR_TURN };
    if (this.isDiscardPendingForPlayer(playerId)) return { ok: false, error: ErrorCode.WRONG_PHASE };

    const ctx = this.gameState.phaseContext as PickSpawnContext;
    const isValid = ctx.availablePositions.some(p => p.x === position.x && p.y === position.y);
    if (!isValid) return { ok: false, error: ErrorCode.CARD_INVALID_TARGET };

    currentPlayer.position = { x: position.x, y: position.y };
    currentPlayer.hasSpawned = true;

    // Test 7: Check stuck after spawn — triggers respawn, not elimination
    this.performStuckCheck();

    this.broadcastState();
    this.startPhase0();
    return { ok: true };
  }

  // ─── Phase 0: Draw card ───────────────────────────────────

  startPhase0(): void {
    if (this.isFinished()) return;
    this.clearCardPhaseTimer();
    this.pendingDiceResult = 0;

    this.gameState.currentPhase = Phase.DRAW_CARD;
    this.gameState.phaseContext = { phase: 0 };

    const currentPlayer = this.gameState.getCurrentPlayer();
    const drawnCard = this.gameState.deck.draw();

    if (!drawnCard) {
      this.gameState.publicReveal = null;
      this.gameState.touch();
      this.startPhase1();
      return;
    }

    const expiresAt = Date.now() + TIMINGS.PUBLIC_REVEAL_MS;
    this.gameState.publicReveal = {
      playerId: currentPlayer.id,
      card: drawnCard.toJSON(),
      source: 'phase0',
      expiresAt,
    };

    this.broadcastState();
    this.broadcastFn('game:card_public_reveal', {
      playerId: currentPlayer.id,
      playerName: currentPlayer.name,
      card: drawnCard.toJSON(),
      source: 'phase0',
      expiresAt,
    });
    this.sendPrivateUpdate(currentPlayer.id);

    this.setManagedTimeout(() => {
      if (this.isFinished()) return;
      const revealOwner = this.gameState.getCurrentPlayer();
      this.gameState.publicReveal = null;
      revealOwner.addCard(drawnCard);
      this.broadcastFn('game:card_reveal_ended', { playerId: revealOwner.id });
      this.broadcastState();
      this.sendPrivateUpdate(revealOwner.id);
      if (this.requireDiscardIfNeeded(revealOwner.id, () => this.startPhase1())) {
        return;
      }
      this.startPhase1();
    }, TIMINGS.PUBLIC_REVEAL_MS);
  }

  // ─── Phase 1: Roll dice ───────────────────────────────────

  startPhase1(): void {
    if (this.isFinished()) return;
    const rollEndAt = Date.now() + TIMINGS.DICE_ROLL_MS;
    this.gameState.currentPhase = Phase.ROLL_DICE;
    this.gameState.phaseContext = { phase: 1, diceResult: null, rollEndAt };
    this.broadcastState();

    this.setManagedTimeout(() => {
      if (this.isFinished()) return;
      const diceResult = Math.floor(Math.random() * 6) + 1;
      this.pendingDiceResult = diceResult;
      this.gameState.phaseContext = { phase: 1, diceResult, rollEndAt } as Phase1Context;
      this.broadcastState();
      this.setManagedTimeout(() => this.startPhase2Card(), 500);
    }, TIMINGS.DICE_ROLL_MS);
  }

  // ─── Phase 2: Card (pre-move) ─────────────────────────────

  startPhase2Card(): void {
    if (this.isFinished()) return;
    this.startCardPhase(2);
  }

  // ─── Phase 3: Move ────────────────────────────────────────

  startPhase3Move(steps: number): void {
    if (this.isFinished()) return;
    const currentPlayer = this.gameState.getCurrentPlayer();
    const teammatePos = this.getTeammatePosition(currentPlayer.id);
    const tetherLen = this.getTetherLength(currentPlayer.id);

    const validDirections = MovementValidator.getValidDirections(
      this.gameState.board, currentPlayer.position, currentPlayer.id,
      null, this.gameState.getOccupiedPositions(currentPlayer.id),
      teammatePos, tetherLen,
    );

    const ctx: Phase2Context = {
      phase: 3, diceResult: steps, stepsRemaining: steps,
      prevPosition: null, validDirections,
    };
    this.gameState.currentPhase = Phase.MOVE;
    this.gameState.phaseContext = ctx;
    this.broadcastState();

    if (validDirections.length === 0) {
      // No possible first step: end movement immediately and lock next turn.
      this.lockCurrentPlayerAndEndTurn();
      return;
    }

    if (this.isBotTurn()) {
      this.setManagedTimeout(() => this.runBotMovementStep(), 280);
    }
  }

  handleMove(playerId: string, direction: Direction): { ok: boolean; error?: string } {
    if (this.isFinished()) return { ok: false, error: ErrorCode.GAME_ALREADY_OVER };
    if (this.gameState.currentPhase !== Phase.MOVE) return { ok: false, error: ErrorCode.WRONG_PHASE };

    const currentPlayer = this.gameState.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return { ok: false, error: ErrorCode.NOT_YOUR_TURN };
    if (this.isDiscardPendingForPlayer(playerId)) return { ok: false, error: ErrorCode.WRONG_PHASE };

    const movCtx = this.gameState.phaseContext as Phase2Context;
    if (movCtx.phase !== 3) return { ok: false, error: ErrorCode.WRONG_PHASE };
    if (!movCtx.validDirections.includes(direction)) return { ok: false, error: ErrorCode.INVALID_DIRECTION };

    const newPos = MovementValidator.directionToPosition(currentPlayer.position, direction);
    const prevPos: Position = { ...currentPlayer.position };
    currentPlayer.position = { ...newPos };
    movCtx.stepsRemaining -= 1;
    movCtx.prevPosition = prevPos;

    const teammatePos = this.getTeammatePosition(currentPlayer.id);
    const tetherLen = this.getTetherLength(currentPlayer.id);
    movCtx.validDirections = MovementValidator.getValidDirections(
      this.gameState.board, currentPlayer.position, currentPlayer.id,
      prevPos, this.gameState.getOccupiedPositions(currentPlayer.id),
      teammatePos, tetherLen,
    );
    this.gameState.phaseContext = movCtx;
    this.broadcastState();

    if (movCtx.stepsRemaining === 0) {
      this.setManagedTimeout(() => this.onMovementComplete(), 300);
      return { ok: true };
    }

    if (movCtx.validDirections.length === 0) {
      this.lockCurrentPlayerAndEndTurn();
      return { ok: true };
    }

    return { ok: true };
  }

  // ─── Landing effects ──────────────────────────────────────

  onPositionLanded(source: 'phase2' | 'phase3'): { gameEnded: boolean } {
    const currentPlayer = this.gameState.getCurrentPlayer();
    return this.applyLandingEffectsForPlayer(currentPlayer.id, source);
  }

  private applyLandingEffectsForPlayer(
    playerId: string,
    source: 'phase2' | 'phase3',
  ): { gameEnded: boolean } {
    if (this.isFinished()) return { gameEnded: true };

    const player = this.gameState.getPlayerById(playerId);
    if (!player) return { gameEnded: false };

    const cell = this.gameState.board.getCell(player.position.x, player.position.y);
    if (!cell) return { gameEnded: false };

    // 1) Claim
    if (this.gameState.board.tryClaimCell(cell.x, cell.y, player.id, player.zodiac)) {
      player.claimedCount += 1;
      this.gameState.updateTeamAfterClaim(player.id);
    }

    // 2) Team win check
    const winningTeamId = WinLossChecker.checkTeamWin(this.gameState.teams);
    if (winningTeamId) {
      this.handleGameOver(winningTeamId);
      return { gameEnded: true };
    }

    // 3) Draw card if landed on draw cell
    if (cell.type === CellType.DRAW) {
      const drawnCard = this.gameState.deck.draw();
      if (drawnCard) {
        const revealSource = source === 'phase2' ? 'phase2c' : 'phase3';
        const expiresAt = Date.now() + TIMINGS.PUBLIC_REVEAL_MS;
        this.gameState.publicReveal = {
          playerId: player.id, card: drawnCard.toJSON(), source: revealSource, expiresAt,
        };
        this.broadcastState();
        this.broadcastFn('game:card_public_reveal', {
          playerId: player.id, playerName: player.name,
          card: drawnCard.toJSON(), source: revealSource, expiresAt,
        });
        this.setManagedTimeout(() => {
          if (this.isFinished()) return;
          const revealOwner = this.gameState.getPlayerById(player.id);
          if (!revealOwner) return;
          this.gameState.publicReveal = null;
          revealOwner.addCard(drawnCard);
          this.broadcastFn('game:card_reveal_ended', { playerId: revealOwner.id });
          if (this.requireDiscardIfNeeded(revealOwner.id)) {
            this.broadcastState();
            return;
          }
          this.refreshPlayableCardsForCurrentCardPhase(revealOwner.id);
          this.broadcastState();
          this.sendPrivateUpdate(revealOwner.id);
        }, TIMINGS.PUBLIC_REVEAL_MS);
      }
    }

    // 4) Stuck check (respawn, not elimination)
    this.performStuckCheck();

    this.broadcastState();
    return { gameEnded: false };
  }

  /**
   * Test 7: Check all players for stuck state, trigger respawn for stuck ones.
   */
  private performStuckCheck(): void {
    const stuckIds = WinLossChecker.checkStuck(this.gameState.players, this.gameState.board);
    for (const stuckId of stuckIds) {
      const stuckPlayer = this.gameState.getPlayerById(stuckId);
      if (!stuckPlayer) continue;

      const result = this.gameState.handlePlayerStuck(stuckId);
      const team = this.gameState.getTeamForPlayer(stuckId)!;

      this.broadcastFn('game:player_respawn', {
        playerId: stuckPlayer.id,
        playerName: stuckPlayer.name,
        teamId: stuckPlayer.teamId,
        reason: 'stuck',
        respawnPosition: result.respawnPosition,
        cellsLost: result.cellsLost,
        newTetherLength: result.newTetherLength,
        newTeamClaimed: result.newTeamClaimed,
      });

      // Check team win after respawn (if auto-claimed on respawn)
      if (result.claimedOnRespawn) {
        const winTeam = WinLossChecker.checkTeamWin(this.gameState.teams);
        if (winTeam) {
          this.handleGameOver(winTeam);
          return;
        }
      }
    }
  }

  onMovementComplete(): void {
    const result = this.onPositionLanded('phase2');
    if (result.gameEnded) return;
    this.startPhase4Card();
  }

  // ─── Phase 4: Card (post-move) ────────────────────────────

  startPhase4Card(): void {
    if (this.isFinished()) return;
    this.startCardPhase(4);
  }

  // ─── Card play ────────────────────────────────────────────

  handlePlayCard(
    playerId: string, cardId: string, targetPos?: Position, helperCardId?: string,
  ): PlayCardResult {
    if (this.isFinished()) return { ok: false, error: ErrorCode.GAME_ALREADY_OVER };
    if (this.gameState.currentPhase !== Phase.PLAY_CARD) return { ok: false, error: ErrorCode.WRONG_PHASE };

    const currentPlayer = this.gameState.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return { ok: false, error: ErrorCode.NOT_YOUR_TURN };
    if (this.isDiscardPendingForPlayer(playerId)) return { ok: false, error: ErrorCode.WRONG_PHASE };

    const cardPhase = this.gameState.phaseContext as Phase3Context;
    if (cardPhase.phase !== 2 && cardPhase.phase !== 4) return { ok: false, error: ErrorCode.WRONG_PHASE };

    const card = currentPlayer.getCard(cardId);
    if (!card) return { ok: false, error: ErrorCode.CARD_NOT_IN_HAND };
    if (!cardPhase.playableCards.includes(cardId)) return { ok: false, error: ErrorCode.CARD_NOT_PLAYABLE };

    if (card.type === CardType.SWAP_TEAMMATE) {
      if (targetPos || helperCardId) {
        return { ok: false, error: ErrorCode.CARD_TARGET_NOT_NEEDED };
      }
      return this.handleSwapTeammateCard(currentPlayer.id, cardId, cardPhase);
    }

    if (card.type === CardType.CHANGE_TEAMMATE) {
      return this.handleChangeTeammateCard(currentPlayer.id, cardId, targetPos, helperCardId, cardPhase);
    }

    const teammatePos = this.getTeammatePosition(currentPlayer.id);
    const tetherLen = this.getTetherLength(currentPlayer.id);

    const validTargets = card.getValidTargets(
      currentPlayer.position, this.gameState.board, currentPlayer.id, currentPlayer.zodiac,
      this.gameState.getOccupiedPositions(currentPlayer.id), teammatePos, tetherLen,
    );

    if (card.type !== CardType.EXTRA_TURN) {
      if (!targetPos) return { ok: false, error: ErrorCode.CARD_TARGET_REQUIRED, validTargets };
      const isValid = validTargets.some(p => p.x === targetPos.x && p.y === targetPos.y);
      if (!isValid) return { ok: false, error: ErrorCode.CARD_INVALID_TARGET, validTargets };
    } else if (targetPos) {
      return { ok: false, error: ErrorCode.CARD_TARGET_NOT_NEEDED };
    }

    const result = card.apply(currentPlayer.position, targetPos ?? null);
    currentPlayer.removeCard(cardId);
    this.gameState.deck.discard(card);

    if (result.extraTurn) {
      this.clearCardPhaseTimer();
      this.handleExtraTurn();
      return { ok: true };
    }

    currentPlayer.position = { x: result.newPosition.x, y: result.newPosition.y };
    const landed = this.onPositionLanded('phase3');
    if (landed.gameEnded) return { ok: true };

    this.resetCardPhaseAfterSuccessfulPlay(currentPlayer.id, cardPhase.phase);
    return { ok: true };
  }

  handleEndCardPhase(playerId: string): { ok: boolean; error?: string } {
    if (this.isFinished()) return { ok: false, error: ErrorCode.GAME_ALREADY_OVER };
    if (this.gameState.currentPhase !== Phase.PLAY_CARD) return { ok: false, error: ErrorCode.WRONG_PHASE };
    const currentPlayer = this.gameState.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return { ok: false, error: ErrorCode.NOT_YOUR_TURN };
    if (this.isDiscardPendingForPlayer(playerId)) return { ok: false, error: ErrorCode.WRONG_PHASE };
    const cardPhase = this.gameState.phaseContext as Phase3Context;
    if (cardPhase.phase !== 2 && cardPhase.phase !== 4) return { ok: false, error: ErrorCode.WRONG_PHASE };
    this.clearCardPhaseTimer();
    this.advanceAfterCardPhase(cardPhase.phase);
    return { ok: true };
  }

  handleDiscardCards(playerId: string, cardIds: string[]): { ok: boolean; error?: string } {
    if (this.isFinished()) return { ok: false, error: ErrorCode.GAME_ALREADY_OVER };
    if (!Array.isArray(cardIds)) return { ok: false, error: ErrorCode.INVALID_PAYLOAD };
    if (!this.pendingDiscard || this.pendingDiscard.playerId !== playerId) {
      return { ok: false, error: ErrorCode.WRONG_PHASE };
    }

    const player = this.gameState.getPlayerById(playerId);
    if (!player) return { ok: false, error: ErrorCode.ROOM_NOT_IN_ROOM };

    const requiredNow = Math.max(0, player.hand.length - TurnEngine.HAND_LIMIT);
    if (requiredNow <= 0) {
      this.finalizePendingDiscard(playerId, [], false);
      return { ok: true };
    }

    const uniqueIds = [...new Set(cardIds)];
    if (uniqueIds.length !== cardIds.length) {
      return { ok: false, error: ErrorCode.INVALID_PAYLOAD };
    }
    if (uniqueIds.length !== requiredNow) {
      return { ok: false, error: ErrorCode.INVALID_PAYLOAD };
    }

    const discardedCardIds: string[] = [];
    for (const cardId of uniqueIds) {
      const card = player.removeCard(cardId);
      if (!card) {
        return { ok: false, error: ErrorCode.CARD_NOT_IN_HAND };
      }
      this.gameState.deck.discard(card);
      discardedCardIds.push(card.id);
    }

    this.finalizePendingDiscard(playerId, discardedCardIds, false);
    return { ok: true };
  }

  handleExtraTurn(): void {
    if (this.isFinished()) return;
    this.pendingDiceResult = 0;
    this.gameState.turnNumber += 1;
    this.gameState.touch();
    this.beginTurnForCurrentPlayer();
  }

  // ─── Turn management ─────────────────────────────────────

  endTurn(): void {
    if (this.isFinished()) return;
    this.clearCardPhaseTimer();

    const totalPlayers = this.gameState.turnOrder.length;
    if (totalPlayers === 0) return;

    // Test 7: No permanent elimination — just advance to next player
    let nextIndex = (this.gameState.currentPlayerIndex + 1) % totalPlayers;

    this.pendingDiceResult = 0;
    this.gameState.currentPlayerIndex = nextIndex;
    this.gameState.turnNumber += 1;
    this.gameState.touch();
    this.beginTurnForCurrentPlayer();
  }

  // ─── Game Over ────────────────────────────────────────────

  handleGameOver(winningTeamId: string): void {
    if (this.gameState.status === RoomStatus.FINISHED) return;

    this.gameState.status = RoomStatus.FINISHED;
    this.gameState.winner = winningTeamId;
    this.clearAllTimers();
    this.gameState.touch();

    const team = this.gameState.getTeam(winningTeamId);
    const finalState = this.gameState.toPublicGameState();

    const claimedByPlayer: Record<string, number> = {};
    const claimedByTeam: Record<string, number> = {};
    for (const player of this.gameState.players) {
      claimedByPlayer[player.id] = player.claimedCount;
    }
    for (const t of this.gameState.teams) {
      claimedByTeam[t.teamId] = t.totalClaimed;
    }

    const winnerPlayers = team ? team.playerIds.map(id => this.gameState.getPlayerById(id)!) : [];

    this.broadcastFn('game:over', {
      winner: {
        teamId: winningTeamId,
        playerIds: team ? team.playerIds : [],
        playerNames: winnerPlayers.map(p => p?.name ?? 'Unknown'),
        zodiacs: team ? team.zodiacs : [],
      },
      reason: 'team_claimed_all',
      finalState,
      stats: { totalTurns: this.gameState.turnNumber, claimedByPlayer, claimedByTeam },
    });

    this.broadcastFn('game:state_update', { state: finalState });
  }

  // ─── Timer management ────────────────────────────────────

  addTimer(timer: NodeJS.Timeout): void { this.activeTimers.push(timer); }

  clearCardPhaseTimer(): void {
    if (!this.cardPhaseTimer) return;
    clearTimeout(this.cardPhaseTimer);
    this.removeTimer(this.cardPhaseTimer);
    this.cardPhaseTimer = null;
  }

  clearAllTimers(): void {
    for (const timer of this.activeTimers) clearTimeout(timer);
    this.activeTimers = [];
    this.cardPhaseTimer = null;
    this.discardDecisionTimer = null;
    this.pendingDiscard = null;
    this.pausedCardPhase = null;
  }

  // ─── Internal helpers ─────────────────────────────────────

  private startCardPhase(phaseNumber: 2 | 4): void {
    this.clearCardPhaseTimer();
    const currentPlayer = this.gameState.getCurrentPlayer();
    const playableCards = this.gameState.computePlayableCards(currentPlayer.id);
    const timerExpiresAt = Date.now() + TIMINGS.CARD_PHASE_BASE_MS;

    this.gameState.currentPhase = Phase.PLAY_CARD;
    this.gameState.phaseContext = { phase: phaseNumber, timerExpiresAt, playableCards };
    this.broadcastState();
    this.sendPrivateUpdate(currentPlayer.id);

    if (this.isBotTurn()) {
      this.cardPhaseTimer = this.setManagedTimeout(() => this.advanceAfterCardPhase(phaseNumber), 700);
      return;
    }
    this.cardPhaseTimer = this.setManagedTimeout(() => this.advanceAfterCardPhase(phaseNumber), TIMINGS.CARD_PHASE_BASE_MS);
  }

  private advanceAfterCardPhase(phaseNumber: 2 | 4): void {
    if (this.isFinished()) return;
    if (this.gameState.currentPhase !== Phase.PLAY_CARD) return;
    const cardPhase = this.gameState.phaseContext as Phase3Context;
    if (cardPhase.phase !== phaseNumber) return;
    this.clearCardPhaseTimer();

    if (phaseNumber === 2) {
      const steps = this.pendingDiceResult > 0 ? this.pendingDiceResult : 1;
      this.startPhase3Move(steps);
      return;
    }
    this.endTurn();
  }

  private isFinished(): boolean { return this.gameState.status === RoomStatus.FINISHED; }
  private isBotTurn(): boolean { return this.gameState.getCurrentPlayer().socketId.startsWith('bot-'); }
  private isDiscardPendingForPlayer(playerId: string): boolean {
    return Boolean(this.pendingDiscard && this.pendingDiscard.playerId === playerId);
  }

  private lockCurrentPlayerAndEndTurn(): void {
    if (this.isFinished()) return;
    const currentPlayer = this.gameState.getCurrentPlayer();
    currentPlayer.isLocked = true;
    currentPlayer.skipNextTurn = true;
    this.broadcastState();
    this.endTurn();
  }

  private runBotMovementStep(): void {
    if (this.isFinished() || this.gameState.currentPhase !== Phase.MOVE || !this.isBotTurn()) return;

    const currentPlayer = this.gameState.getCurrentPlayer();
    const movCtx = this.gameState.phaseContext as Phase2Context;
    if (movCtx.phase !== 3) return;

    if (movCtx.stepsRemaining <= 0) {
      this.setManagedTimeout(() => this.onMovementComplete(), 300);
      return;
    }

    if (movCtx.validDirections.length === 0) {
      this.lockCurrentPlayerAndEndTurn();
      return;
    }

    const dir = movCtx.validDirections[Math.floor(Math.random() * movCtx.validDirections.length)];
    const result = this.handleMove(currentPlayer.id, dir);

    if (!result.ok) {
      this.lockCurrentPlayerAndEndTurn();
      return;
    }

    if (this.gameState.currentPhase !== Phase.MOVE || !this.isBotTurn()) return;
    const updated = this.gameState.phaseContext as Phase2Context;
    if (updated.phase !== 3) return;

    if (updated.stepsRemaining > 0 && updated.validDirections.length > 0) {
      this.setManagedTimeout(() => this.runBotMovementStep(), 250);
    }
  }

  private removeTimer(timer: NodeJS.Timeout): void {
    this.activeTimers = this.activeTimers.filter(t => t !== timer);
    if (this.cardPhaseTimer === timer) this.cardPhaseTimer = null;
    if (this.discardDecisionTimer === timer) this.discardDecisionTimer = null;
  }

  private setManagedTimeout(callback: () => void, delayMs: number): NodeJS.Timeout {
    let timer: NodeJS.Timeout;
    timer = setTimeout(() => {
      this.removeTimer(timer);
      if (this.isFinished()) return;
      callback();
    }, delayMs);
    this.addTimer(timer);
    return timer;
  }

  private broadcastState(): void {
    this.gameState.touch();
    this.broadcastFn('game:state_update', { state: this.gameState.toPublicGameState() });
  }

  private sendPrivateUpdate(playerId: string): void {
    const player = this.gameState.getPlayerById(playerId);
    if (!player) return;
    const privateState = this.gameState.toPrivateGameState(playerId);
    this.privateFn(player.socketId, 'game:private_update', {
      playerId,
      myHand: privateState.myHand,
      myPlayableCards: privateState.myPlayableCards,
    });
  }

  private refreshPlayableCardsForCurrentCardPhase(playerId: string): void {
    if (this.gameState.currentPhase !== Phase.PLAY_CARD) return;
    const cardPhase = this.gameState.phaseContext as Phase3Context;
    if (cardPhase.phase !== 2 && cardPhase.phase !== 4) return;
    const currentPlayer = this.gameState.getCurrentPlayer();
    if (currentPlayer.id !== playerId) return;
    this.gameState.phaseContext = {
      ...cardPhase, playableCards: this.gameState.computePlayableCards(playerId),
    };
  }

  private requireDiscardIfNeeded(playerId: string, onResolved?: () => void): boolean {
    const player = this.gameState.getPlayerById(playerId);
    if (!player) return false;

    const requiredCount = Math.max(0, player.hand.length - TurnEngine.HAND_LIMIT);
    if (requiredCount <= 0) {
      return false;
    }

    if (this.pendingDiscard) {
      if (this.pendingDiscard.playerId === playerId) {
        this.pendingDiscard.requiredCount = requiredCount;
        this.pendingDiscard.onResolved = onResolved ?? this.pendingDiscard.onResolved;
      }
      return true;
    }

    this.pauseCardPhaseForDiscard(playerId);

    const expiresAt = Date.now() + TIMINGS.DISCARD_DECISION_MS;
    this.pendingDiscard = {
      playerId,
      requiredCount,
      expiresAt,
      onResolved: onResolved ?? null,
    };

    this.sendPrivateUpdate(playerId);
    this.privateFn(player.socketId, 'game:discard_required', {
      playerId,
      requiredCount,
      handLimit: TurnEngine.HAND_LIMIT,
      expiresAt,
    });

    if (player.socketId.startsWith('bot-')) {
      this.resolveDiscardRandom(playerId);
      return true;
    }

    this.clearDiscardDecisionTimer();
    this.discardDecisionTimer = this.setManagedTimeout(() => {
      this.resolveDiscardRandom(playerId);
    }, TIMINGS.DISCARD_DECISION_MS);
    return true;
  }

  private clearDiscardDecisionTimer(): void {
    if (!this.discardDecisionTimer) return;
    clearTimeout(this.discardDecisionTimer);
    this.removeTimer(this.discardDecisionTimer);
    this.discardDecisionTimer = null;
  }

  private resolveDiscardRandom(playerId: string): void {
    if (!this.pendingDiscard || this.pendingDiscard.playerId !== playerId) return;
    const player = this.gameState.getPlayerById(playerId);
    if (!player) return;

    const overflow = Math.max(0, player.hand.length - TurnEngine.HAND_LIMIT);
    if (overflow <= 0) {
      this.finalizePendingDiscard(playerId, [], true);
      return;
    }

    const cards = [...player.hand];
    GameState.fisherYatesShuffle(cards);

    const discardedCardIds: string[] = [];
    for (let i = 0; i < overflow && i < cards.length; i++) {
      const cardToRemove = player.removeCard(cards[i].id);
      if (!cardToRemove) continue;
      this.gameState.deck.discard(cardToRemove);
      discardedCardIds.push(cardToRemove.id);
    }

    this.finalizePendingDiscard(playerId, discardedCardIds, true);
  }

  private finalizePendingDiscard(
    playerId: string,
    discardedCardIds: string[],
    auto: boolean,
  ): void {
    if (!this.pendingDiscard || this.pendingDiscard.playerId !== playerId) return;
    const pending = this.pendingDiscard;
    this.pendingDiscard = null;
    this.clearDiscardDecisionTimer();

    this.resumeCardPhaseAfterDiscard(playerId);
    this.refreshPlayableCardsForCurrentCardPhase(playerId);
    this.broadcastState();
    this.sendPrivateUpdate(playerId);

    const player = this.gameState.getPlayerById(playerId);
    if (player) {
      this.privateFn(player.socketId, 'game:discard_resolved', {
        playerId,
        discardedCardIds,
        auto,
      });
    }

    if (pending.onResolved) {
      pending.onResolved();
    }
  }

  private pauseCardPhaseForDiscard(playerId: string): void {
    if (this.gameState.currentPhase !== Phase.PLAY_CARD) return;
    if (this.gameState.getCurrentPlayer().id !== playerId) return;
    if (this.pausedCardPhase) return;

    const phaseCtx = this.gameState.phaseContext as Phase3Context;
    if (phaseCtx.phase !== 2 && phaseCtx.phase !== 4) return;

    const remainingMs = Math.max(0, phaseCtx.timerExpiresAt - Date.now());
    this.pausedCardPhase = {
      phaseNumber: phaseCtx.phase,
      remainingMs,
    };
    this.clearCardPhaseTimer();
  }

  private resumeCardPhaseAfterDiscard(playerId: string): void {
    if (!this.pausedCardPhase) return;
    if (this.gameState.currentPhase !== Phase.PLAY_CARD) {
      this.pausedCardPhase = null;
      return;
    }
    if (this.gameState.getCurrentPlayer().id !== playerId) {
      this.pausedCardPhase = null;
      return;
    }

    const phaseCtx = this.gameState.phaseContext as Phase3Context;
    if (
      (phaseCtx.phase !== 2 && phaseCtx.phase !== 4)
      || phaseCtx.phase !== this.pausedCardPhase.phaseNumber
    ) {
      this.pausedCardPhase = null;
      return;
    }

    const nextRemainingMs = this.pausedCardPhase.remainingMs;
    this.pausedCardPhase = null;

    this.gameState.phaseContext = {
      ...phaseCtx,
      timerExpiresAt: Date.now() + nextRemainingMs,
    };

    this.clearCardPhaseTimer();
    this.cardPhaseTimer = this.setManagedTimeout(
      () => this.advanceAfterCardPhase(phaseCtx.phase as 2 | 4),
      nextRemainingMs,
    );
  }

  private handleChangeTeammateCard(
    playerId: string,
    changeCardId: string,
    targetPos: Position | undefined,
    helperCardId: string | undefined,
    cardPhase: Phase3Context,
  ): PlayCardResult {
    const player = this.gameState.getPlayerById(playerId);
    const teammate = this.gameState.getTeammate(playerId);
    if (!player || !teammate || !teammate.hasSpawned) {
      return { ok: false, error: ErrorCode.CARD_NOT_PLAYABLE };
    }

    const helperIds = this.gameState.getValidChangeTeammateHelperCardIds(playerId, changeCardId);
    if (helperIds.length === 0) {
      return { ok: false, error: ErrorCode.CARD_NOT_PLAYABLE };
    }

    if (!helperCardId) {
      return {
        ok: false,
        error: ErrorCode.CARD_LINKED_CARD_REQUIRED,
        helperCardIds: helperIds,
      };
    }

    if (!helperIds.includes(helperCardId)) {
      return {
        ok: false,
        error: ErrorCode.CARD_LINKED_CARD_INVALID,
        helperCardIds: helperIds,
      };
    }

    const validTargets = this.gameState.getValidChangeTeammateTargets(playerId, helperCardId);
    if (validTargets.length === 0) {
      return {
        ok: false,
        error: ErrorCode.CARD_LINKED_CARD_INVALID,
        helperCardIds: helperIds,
      };
    }

    if (!targetPos) {
      return {
        ok: false,
        error: ErrorCode.CARD_TARGET_REQUIRED,
        validTargets,
        helperCardId,
      };
    }

    const isValidTarget = validTargets.some(pos => pos.x === targetPos.x && pos.y === targetPos.y);
    if (!isValidTarget) {
      return {
        ok: false,
        error: ErrorCode.CARD_INVALID_TARGET,
        validTargets,
        helperCardId,
      };
    }

    const changeCard = player.removeCard(changeCardId);
    const helperCard = player.removeCard(helperCardId);
    if (!changeCard || !helperCard) {
      return { ok: false, error: ErrorCode.CARD_NOT_IN_HAND };
    }

    this.gameState.deck.discard(changeCard);
    this.gameState.deck.discard(helperCard);

    teammate.position = { x: targetPos.x, y: targetPos.y };

    const teammateLanded = this.applyLandingEffectsForPlayer(teammate.id, 'phase3');
    if (teammateLanded.gameEnded) {
      return { ok: true };
    }

    this.resetCardPhaseAfterSuccessfulPlay(playerId, cardPhase.phase);
    return { ok: true };
  }

  private handleSwapTeammateCard(
    playerId: string,
    swapCardId: string,
    cardPhase: Phase3Context,
  ): PlayCardResult {
    const player = this.gameState.getPlayerById(playerId);
    const teammate = this.gameState.getTeammate(playerId);
    if (!player || !teammate || !teammate.hasSpawned) {
      return { ok: false, error: ErrorCode.CARD_NOT_PLAYABLE };
    }

    const swapCard = player.removeCard(swapCardId);
    if (!swapCard) {
      return { ok: false, error: ErrorCode.CARD_NOT_IN_HAND };
    }
    this.gameState.deck.discard(swapCard);

    const oldPlayerPos: Position = { x: player.position.x, y: player.position.y };
    const oldTeammatePos: Position = { x: teammate.position.x, y: teammate.position.y };

    // Test 10: swap positions; only teammate triggers landing effects.
    player.position = oldTeammatePos;
    teammate.position = oldPlayerPos;

    const teammateLanded = this.applyLandingEffectsForPlayer(teammate.id, 'phase3');
    if (teammateLanded.gameEnded) {
      return { ok: true };
    }

    this.resetCardPhaseAfterSuccessfulPlay(playerId, cardPhase.phase);
    return { ok: true };
  }

  private resetCardPhaseAfterSuccessfulPlay(playerId: string, phaseNumber: 2 | 4): void {
    const now = Date.now();
    const phaseCtx = this.gameState.phaseContext as Phase3Context;
    const remainingMs = Math.max(0, phaseCtx.timerExpiresAt - now);
    const nextRemainingMs = Math.min(
      remainingMs + TIMINGS.CARD_PHASE_BONUS_MS,
      TIMINGS.CARD_PHASE_BASE_MS,
    );

    this.gameState.phaseContext = {
      phase: phaseNumber,
      timerExpiresAt: now + nextRemainingMs,
      playableCards: this.gameState.computePlayableCards(playerId),
    };

    this.clearCardPhaseTimer();
    this.cardPhaseTimer = this.setManagedTimeout(
      () => this.advanceAfterCardPhase(phaseNumber),
      nextRemainingMs,
    );

    this.broadcastState();
    this.sendPrivateUpdate(playerId);
  }
}
