// ============================================================
// Card — Represents a single card with its effect logic.
// 15 card types: symmetric_h, symmetric_v, corner, extra_turn, 12 zodiac cards.
// Test 7: Added tether check for movement cards; zodiac cells now 5 per active.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import {
  CardType, CardState, Position, ZodiacName, ApplyResult,
  CARD_TYPE_TO_DISPLAY_NAME, CARD_TYPE_TO_ZODIAC, MAP,
} from '../types';
import { Board } from './Board';
import { GameState } from './GameState';

export class Card {
  public readonly id: string;
  public readonly type: CardType;
  public readonly displayName: string;

  constructor(type: CardType) {
    this.id = uuidv4();
    this.type = type;
    this.displayName = CARD_TYPE_TO_DISPLAY_NAME[type];
  }

  /**
   * Calculate valid target positions for this card.
   * Returns [] if the card cannot be used.
   *
   * Test 7: All movement cards check tether constraint.
   * Zodiac cards now target 5 cells per active zodiac.
   * Góc/Đối xứng can land on BLANK cells.
   */
  getValidTargets(
    currentPos: Position,
    board: Board,
    playerId: string,
    playerZodiac: ZodiacName,
    occupiedPositions: Position[] = [],
    teammatePosition: Position | null = null,
    tetherLength: number = 999,
  ): Position[] {
    const occupiedSet = new Set(occupiedPositions.map(pos => `${pos.x},${pos.y}`));

    switch (this.type) {
      case CardType.SYMMETRIC_H:
        return this._getSymmetricHTargets(currentPos, board, playerId, occupiedSet, teammatePosition, tetherLength);

      case CardType.SYMMETRIC_V:
        return this._getSymmetricVTargets(currentPos, board, playerId, occupiedSet, teammatePosition, tetherLength);

      case CardType.CORNER:
        return this._getCornerTargets(board, playerId, occupiedSet, teammatePosition, tetherLength);

      case CardType.EXTRA_TURN:
        // Always usable — return current position as a marker
        return [{ x: currentPos.x, y: currentPos.y }];

      case CardType.CHANGE_TEAMMATE:
        // Test 9: handled by TurnEngine as a 2-card combo flow.
        return [];

      case CardType.SWAP_TEAMMATE:
        // Test 10: target-less card, only usable when teammate has spawned.
        return teammatePosition ? [{ x: currentPos.x, y: currentPos.y }] : [];

      default:
        // Zodiac card (zodiac_ty, zodiac_suu, etc.)
        return this._getZodiacTargets(board, playerId, playerZodiac, occupiedSet, teammatePosition, tetherLength);
    }
  }

  /**
   * Apply the card effect.
   * Returns the new position and whether this triggers an extra turn.
   */
  apply(currentPos: Position, targetPos: Position | null): ApplyResult {
    if (this.type === CardType.EXTRA_TURN) {
      return { newPosition: { x: currentPos.x, y: currentPos.y }, extraTurn: true };
    }
    return { newPosition: targetPos!, extraTurn: false };
  }

  /** Serialize to CardState for network/storage */
  toJSON(): CardState {
    return {
      id: this.id,
      type: this.type,
      displayName: this.displayName,
    };
  }

  // ─── Private: target calculation per card type ────────────

  /**
   * Đối xứng ngang: (x, y) → (x, MAP.ROWS - 1 - y)
   * Single target. Blocked or tether violation → unusable.
   * Test 7: Can land on BLANK cells.
   */
  private _getSymmetricHTargets(
    currentPos: Position,
    board: Board,
    playerId: string,
    occupiedSet: Set<string>,
    teammatePosition: Position | null,
    tetherLength: number,
  ): Position[] {
    const target: Position = { x: currentPos.x, y: MAP.ROWS - 1 - currentPos.y };
    const cell = board.getCell(target.x, target.y);
    if (!cell || cell.isBlockedFor(playerId)) return [];
    if (occupiedSet.has(`${target.x},${target.y}`)) return [];
    // Test 7: tether check
    if (teammatePosition) {
      const dist = GameState.calculateTetherDistance(target, teammatePosition);
      if (dist > tetherLength) return [];
    }
    return [target];
  }

  /**
   * Đối xứng dọc: (x, y) → (MAP.COLS - 1 - x, y)
   * Single target. Blocked or tether violation → unusable.
   * Test 7: Can land on BLANK cells.
   */
  private _getSymmetricVTargets(
    currentPos: Position,
    board: Board,
    playerId: string,
    occupiedSet: Set<string>,
    teammatePosition: Position | null,
    tetherLength: number,
  ): Position[] {
    const target: Position = { x: MAP.COLS - 1 - currentPos.x, y: currentPos.y };
    const cell = board.getCell(target.x, target.y);
    if (!cell || cell.isBlockedFor(playerId)) return [];
    if (occupiedSet.has(`${target.x},${target.y}`)) return [];
    // Test 7: tether check
    if (teammatePosition) {
      const dist = GameState.calculateTetherDistance(target, teammatePosition);
      if (dist > tetherLength) return [];
    }
    return [target];
  }

  /**
   * Góc: choose 1 of the 4 corners.
   * Filter out blocked corners and tether violations.
   * Test 7: Can land on BLANK cells (corners may be blank).
   */
  private _getCornerTargets(
    board: Board,
    playerId: string,
    occupiedSet: Set<string>,
    teammatePosition: Position | null,
    tetherLength: number,
  ): Position[] {
    return MAP.CORNERS.filter(corner => {
      const cell = board.getCell(corner.x, corner.y);
      if (!cell || cell.isBlockedFor(playerId)) return false;
      if (occupiedSet.has(`${corner.x},${corner.y}`)) return false;
      // Test 7: tether check
      if (teammatePosition) {
        const dist = GameState.calculateTetherDistance(corner, teammatePosition);
        if (dist > tetherLength) return false;
      }
      return true;
    });
  }

  /**
   * Zodiac card: move to one of the cells of that zodiac.
   * Test 7: Each active zodiac has 5 cells (not 9).
   * Bài con giáp CANNOT teleport to BLANK cells.
   *
   * Rules:
   * - If player IS that zodiac: all cells valid (even own claimed ones), exclude others' claims
   * - If player is NOT that zodiac: only unclaimed cells
   * - Always filter out cells blocked by other players and tether violations
   */
  private _getZodiacTargets(
    board: Board,
    playerId: string,
    playerZodiac: ZodiacName,
    occupiedSet: Set<string>,
    teammatePosition: Position | null,
    tetherLength: number,
  ): Position[] {
    const cardZodiac = CARD_TYPE_TO_ZODIAC[this.type];
    if (!cardZodiac) return [];

    const zodiacCells = board.getZodiacCells(cardZodiac);

    return zodiacCells
      .filter(cell => {
        if (playerZodiac === cardZodiac) {
          // Own zodiac: can go to any cell (even if claimed by self)
          if (cell.isBlockedFor(playerId)) return false;
          if (occupiedSet.has(`${cell.x},${cell.y}`)) return false;
        } else {
          // Other zodiac: only unclaimed cells
          if (cell.claimedBy !== null) return false;
          if (occupiedSet.has(`${cell.x},${cell.y}`)) return false;
        }
        // Test 7: tether check
        if (teammatePosition) {
          const dist = GameState.calculateTetherDistance({ x: cell.x, y: cell.y }, teammatePosition);
          if (dist > tetherLength) return false;
        }
        return true;
      })
      .map(cell => ({ x: cell.x, y: cell.y }));
  }
}
