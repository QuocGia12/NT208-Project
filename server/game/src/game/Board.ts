// ============================================================
// Board — Manages the game board.
// Test 11: New composition — 4×5 active + 13 draw + 30 blank = 63 (no walls)
// ============================================================

import {
  CellType, CellState, BoardState, Position, ZodiacName,
  ALL_ZODIACS, MAP,
} from '../types';
import { Cell } from './Cell';

export class Board {
  public cells: Cell[];           // flat array, length = MAP.TOTAL_CELLS
  public activeZodiacs: ZodiacName[];  // 4 zodiacs used this game

  constructor(cells: Cell[], activeZodiacs: ZodiacName[]) {
    this.cells = cells;
    this.activeZodiacs = activeZodiacs;
  }

  // ─── Index helpers ────────────────────────────────────────

  /** Convert (x, y) → flat array index */
  static getIndex(x: number, y: number): number {
    return y * MAP.COLS + x;
  }

  /** Check if (x, y) is within current map bounds */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < MAP.COLS && y >= 0 && y < MAP.ROWS;
  }

  // ─── Cell access ──────────────────────────────────────────

  /** Get the cell at (x, y), or null if out of bounds */
  getCell(x: number, y: number): Cell | null {
    if (!this.isInBounds(x, y)) return null;
    return this.cells[Board.getIndex(x, y)];
  }

  /** Get all cells belonging to a specific zodiac */
  getZodiacCells(zodiac: ZodiacName): Cell[] {
    return this.cells.filter(c => c.type === CellType.ZODIAC && c.zodiac === zodiac);
  }

  /** Get all draw cells */
  getDrawCells(): Cell[] {
    return this.cells.filter(c => c.type === CellType.DRAW);
  }

  /** Get all blank cells */
  getBlankCells(): Cell[] {
    return this.cells.filter(c => c.type === CellType.BLANK);
  }

  /** Get up to 4 in-bounds adjacent positions (no diagonals) */
  getAdjacentPositions(x: number, y: number): Position[] {
    const deltas: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const result: Position[] = [];
    for (const [dx, dy] of deltas) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isInBounds(nx, ny)) {
        result.push({ x: nx, y: ny });
      }
    }
    return result;
  }

  // ─── Mutations ────────────────────────────────────────────

  /**
   * Try to claim a cell for a player.
   * Returns true if successfully claimed, false otherwise.
   */
  tryClaimCell(x: number, y: number, playerId: string, playerZodiac: ZodiacName): boolean {
    const cell = this.getCell(x, y);
    if (!cell) return false;
    if (!cell.canBeClaimedBy(playerZodiac)) return false;
    cell.claimedBy = playerId;
    return true;
  }

  /**
   * Test 7: Unclaim a cell — reset it to unclaimed state.
   * Returns true if the cell was claimed and is now unclaimed.
   */
  unclaimCell(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (!cell || !cell.isClaimed()) return false;
    cell.claimedBy = null;
    return true;
  }

  /**
   * Test 7: Get all cells claimed by a specific player.
   */
  getClaimedCellsByPlayer(playerId: string): Cell[] {
    return this.cells.filter(c => c.claimedBy === playerId);
  }

  // ─── Serialization ───────────────────────────────────────

  toJSON(): BoardState {
    return {
      cells: this.cells.map(c => c.toJSON()),
      activeZodiacs: [...this.activeZodiacs],
    };
  }

  // ─── Static factory: generate random board ────────────────

  /**
   * Generate a random board using current MAP settings.
   *
   * Test 11 composition:
   * - Active zodiacs: 5 cells each (4 * 5 = 20) -> type: ZODIAC
   * - Wall cells: 0 -> type: WALL
   * - Draw cells: 13 -> type: DRAW
   * - Blank cells: 30 -> type: BLANK
   * -> Total: 63 cells
   */
  static generate(activeZodiacs: ZodiacName[]): Board {
    const specialCellCount =
      MAP.WALL_CELLS + MAP.DRAW_CELLS + activeZodiacs.length * MAP.ACTIVE_CELLS_PER_ZODIAC;
    if (specialCellCount + MAP.BLANK_CELLS !== MAP.TOTAL_CELLS) {
      throw new Error('Invalid MAP cell composition.');
    }

    const types = new Array<string>(MAP.TOTAL_CELLS).fill('BLANK');
    const availableIndexes = Array.from({ length: MAP.TOTAL_CELLS }, (_, index) => index);

    const placeSpreadGroup = (type: string, count: number): void => {
      const pickedIndexes: number[] = [];

      for (let i = 0; i < count; i++) {
        const pickedAvailableIndex = Board.pickSoftSpreadIndex(availableIndexes, pickedIndexes);
        const [cellIndex] = availableIndexes.splice(pickedAvailableIndex, 1);
        types[cellIndex] = type;
        pickedIndexes.push(cellIndex);
      }
    };

    // Place visible gameplay cells with a soft spread tendency. This is still random:
    // nearby same-type cells can happen, but repeated groups are nudged across the map.
    for (const zodiac of activeZodiacs) {
      placeSpreadGroup(`ZODIAC_${zodiac}`, MAP.ACTIVE_CELLS_PER_ZODIAC);
    }
    placeSpreadGroup('DRAW', MAP.DRAW_CELLS);
    placeSpreadGroup('WALL', MAP.WALL_CELLS);

    const cells: Cell[] = [];
    for (let y = 0; y < MAP.ROWS; y++) {
      for (let x = 0; x < MAP.COLS; x++) {
        const typeStr = types[y * MAP.COLS + x];
        if (typeStr === 'WALL') {
          cells.push(new Cell(x, y, CellType.WALL, null));
        } else if (typeStr === 'DRAW') {
          cells.push(new Cell(x, y, CellType.DRAW, null));
        } else if (typeStr === 'BLANK') {
          cells.push(new Cell(x, y, CellType.BLANK, null));
        } else if (typeStr.startsWith('ZODIAC_')) {
          const zodiac = typeStr.replace('ZODIAC_', '') as ZodiacName;
          cells.push(new Cell(x, y, CellType.ZODIAC, zodiac));
        }
      }
    }

    return new Board(cells, activeZodiacs);
  }

  /** Fisher-Yates (Knuth) shuffle — in-place */
  private static fisherYatesShuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private static pickSoftSpreadIndex(availableIndexes: number[], pickedIndexes: number[]): number {
    if (availableIndexes.length === 0) {
      throw new Error('No available board positions left to place.');
    }
    if (pickedIndexes.length === 0) {
      return Math.floor(Math.random() * availableIndexes.length);
    }

    const sampleSize = Math.min(8, availableIndexes.length);
    let bestAvailableIndex = Math.floor(Math.random() * availableIndexes.length);
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < sampleSize; i++) {
      const availableIndex = Math.floor(Math.random() * availableIndexes.length);
      const candidateIndex = availableIndexes[availableIndex];
      const minDistance = Board.getMinManhattanDistance(candidateIndex, pickedIndexes);

      // Small random jitter keeps this as a tendency instead of a hard spacing rule.
      const score = minDistance + Math.random() * 1.75;
      if (score > bestScore) {
        bestScore = score;
        bestAvailableIndex = availableIndex;
      }
    }

    return bestAvailableIndex;
  }

  private static getMinManhattanDistance(cellIndex: number, otherIndexes: number[]): number {
    const x = cellIndex % MAP.COLS;
    const y = Math.floor(cellIndex / MAP.COLS);
    let minDistance = Number.POSITIVE_INFINITY;

    for (const otherIndex of otherIndexes) {
      const otherX = otherIndex % MAP.COLS;
      const otherY = Math.floor(otherIndex / MAP.COLS);
      const distance = Math.abs(x - otherX) + Math.abs(y - otherY);
      minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
  }


}

// ─── Test / Validation ──────────────────────────────────────

/**
 * Run validation checks on a generated board.
 * Test 11 expected: 20 zodiac + 0 wall + 13 draw + 30 blank = 63
 */
export function testBoardGeneration(): void {
  const activeZodiacs: ZodiacName[] = ['Tý', 'Dần', 'Ngọ', 'Tuất'];
  const board = Board.generate(activeZodiacs);

  console.log('=== Board Generation Test (Test 11) ===\n');

  // Test 1: Total cell count
  const totalCells = board.cells.length;
  console.log(
    `[${totalCells === MAP.TOTAL_CELLS ? '✅' : '❌'}] Total cells: ${totalCells} (expected ${MAP.TOTAL_CELLS})`,
  );

  // Test 2: Zodiac cell count
  const zodiacCells = board.cells.filter(c => c.type === CellType.ZODIAC);
  const expectedZodiacCells = 4 * MAP.ACTIVE_CELLS_PER_ZODIAC; // 4 * 5 = 20
  console.log(
    `[${zodiacCells.length === expectedZodiacCells ? '✅' : '❌'}] Zodiac cells: ${zodiacCells.length} (expected ${expectedZodiacCells})`,
  );

  // Test 3: Draw cell count
  const drawCells = board.getDrawCells();
  console.log(
    `[${drawCells.length === MAP.DRAW_CELLS ? '✅' : '❌'}] Draw cells: ${drawCells.length} (expected ${MAP.DRAW_CELLS})`,
  );

  // Test 4: Wall cell count
  const wallCells = board.cells.filter(c => c.type === CellType.WALL);
  console.log(
    `[${wallCells.length === MAP.WALL_CELLS ? '✅' : '❌'}] Wall cells: ${wallCells.length} (expected ${MAP.WALL_CELLS})`,
  );

  // Test 5: Blank cell count
  const blankCells = board.getBlankCells();
  console.log(
    `[${blankCells.length === MAP.BLANK_CELLS ? '✅' : '❌'}] Blank cells: ${blankCells.length} (expected ${MAP.BLANK_CELLS})`,
  );

  // Test 6: Each active zodiac has exactly ACTIVE_CELLS_PER_ZODIAC cells
  let allZodiacsCorrect = true;
  for (const zodiac of activeZodiacs) {
    const count = board.getZodiacCells(zodiac).length;
    if (count !== MAP.ACTIVE_CELLS_PER_ZODIAC) {
      console.log(`[❌] Zodiac ${zodiac}: ${count} cells (expected ${MAP.ACTIVE_CELLS_PER_ZODIAC})`);
      allZodiacsCorrect = false;
    }
  }
  if (allZodiacsCorrect) {
    console.log(`[✅] All 4 active zodiacs have ${MAP.ACTIVE_CELLS_PER_ZODIAC} cells each`);
  }

  // Test 7: Wall cells have no zodiac association
  const wallsWithZodiac = wallCells.filter(c => c.zodiac !== null);
  console.log(
    `[${wallsWithZodiac.length === 0 ? '✅' : '❌'}] Wall cells have no zodiac: ${wallsWithZodiac.length} have zodiac (expected 0)`,
  );

  // Test 8: Composition totals
  const compositionTotal = zodiacCells.length + wallCells.length + drawCells.length + blankCells.length;
  console.log(
    `[${compositionTotal === MAP.TOTAL_CELLS ? '✅' : '❌'}] Composition: ${zodiacCells.length}Z + ${wallCells.length}W + ${drawCells.length}D + ${blankCells.length}B = ${compositionTotal} (expected ${MAP.TOTAL_CELLS})`,
  );

  // Test 9: All cells have correct coordinates
  let allCoordsCorrect = true;
  for (let y = 0; y < MAP.ROWS; y++) {
    for (let x = 0; x < MAP.COLS; x++) {
      const cell = board.getCell(x, y)!;
      if (cell.x !== x || cell.y !== y) {
        console.log(`[❌] Cell at index ${Board.getIndex(x, y)}: expected (${x},${y}), got (${cell.x},${cell.y})`);
        allCoordsCorrect = false;
      }
    }
  }
  if (allCoordsCorrect) {
    console.log(`[✅] All ${MAP.TOTAL_CELLS} cells have correct (x,y) coordinates`);
  }

  // Test 10: Cell logic
  const testCell = board.getZodiacCells(activeZodiacs[0])[0];
  console.log(`\n--- Cell logic test on (${testCell.x},${testCell.y}) zodiac=${testCell.zodiac} ---`);
  console.log(`[${!testCell.isClaimed() ? '✅' : '❌'}] Initially not claimed`);
  console.log(`[${!testCell.isBlockedFor('player1') ? '✅' : '❌'}] Not blocked when unclaimed`);
  console.log(`[${testCell.canBeClaimedBy(activeZodiacs[0]) ? '✅' : '❌'}] Can be claimed by matching zodiac`);
  testCell.claimedBy = 'player1';
  console.log(`[${testCell.isClaimed() ? '✅' : '❌'}] Now claimed`);
  console.log(`[${!testCell.isBlockedFor('player1') ? '✅' : '❌'}] Not blocked for owner`);
  console.log(`[${testCell.isBlockedFor('player2') ? '✅' : '❌'}] Blocked for other player`);
  testCell.claimedBy = null;

  // Test 11: Blank cell logic
  const blankCell = board.getBlankCells()[0];
  if (blankCell) {
    console.log(`\n--- Blank cell test on (${blankCell.x},${blankCell.y}) ---`);
    console.log(`[${!blankCell.isBlockedFor('player1') ? '✅' : '❌'}] Blank not blocked`);
    console.log(`[${!blankCell.canBeClaimedBy(activeZodiacs[0]) ? '✅' : '❌'}] Blank cannot be claimed`);
  }

  // Test 12: getAdjacentPositions
  const cornerAdj = board.getAdjacentPositions(0, 0);
  const centerAdj = board.getAdjacentPositions(MAP.CENTER.x, MAP.CENTER.y);
  console.log(`\n[${cornerAdj.length === 2 ? '✅' : '❌'}] Corner (0,0) has ${cornerAdj.length} adjacent (expected 2)`);
  console.log(
    `[${centerAdj.length === 4 ? '✅' : '❌'}] Center (${MAP.CENTER.x},${MAP.CENTER.y}) has ${centerAdj.length} adjacent (expected 4)`,
  );

  // Test 13: unclaimCell
  const claimTestCell = board.getZodiacCells(activeZodiacs[0])[0];
  claimTestCell.claimedBy = 'player1';
  const unclaimed = board.unclaimCell(claimTestCell.x, claimTestCell.y);
  console.log(`[${unclaimed && !claimTestCell.isClaimed() ? '✅' : '❌'}] unclaimCell works correctly`);

  console.log('\n=== Board Generation Test Complete ===');
}
