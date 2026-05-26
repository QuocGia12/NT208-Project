// ============================================================
// Cell — Represents a single cell on the board.
// Test 7: Added CellType.BLANK support (passable, no effect).
// ============================================================

import { CellType, CellState, ZodiacName } from '../types';

export class Cell {
  public x: number;
  public y: number;
  public type: CellType;
  public zodiac: ZodiacName | null;
  public claimedBy: string | null;

  constructor(x: number, y: number, type: CellType, zodiac: ZodiacName | null) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.zodiac = zodiac;
    this.claimedBy = null;
  }

  /** Is this cell claimed by anyone? */
  isClaimed(): boolean {
    return this.claimedBy !== null;
  }

  /**
   * Is this cell blocked for the given player?
   * A cell is blocked if it's a WALL or claimed by SOMEONE ELSE.
   * Your own claimed cells are NOT blocked for you.
   * BLANK and DRAW cells are never blocked (passable).
   */
  isBlockedFor(playerId: string): boolean {
    if (this.type === CellType.WALL) return true;
    // BLANK, DRAW, and ZODIAC cells: only blocked if claimed by another player
    return this.claimedBy !== null && this.claimedBy !== playerId;
  }

  /**
   * Can this cell be claimed by a player with the given zodiac?
   * Requirements: must be a zodiac cell, matching zodiac, and not yet claimed.
   * Test 7: BLANK cells cannot be claimed.
   */
  canBeClaimedBy(playerZodiac: ZodiacName): boolean {
    return this.type === CellType.ZODIAC
      && this.zodiac === playerZodiac
      && !this.isClaimed();
  }

  /** Serialize to CellState for network/storage */
  toJSON(): CellState {
    return {
      x: this.x,
      y: this.y,
      type: this.type,
      zodiac: this.zodiac,
      claimedBy: this.claimedBy,
    };
  }
}
