// ============================================================
// MovementValidator — Static utility for move validation.
// No instance state. All methods are static.
// Test 7: Added tether distance check.
// ============================================================

import { Direction, Position } from '../types';
import { Board } from './Board';
import { GameState } from './GameState';

export class MovementValidator {
  /**
   * Convert a direction to the resulting position.
   * UP = y-1, DOWN = y+1, LEFT = x-1, RIGHT = x+1
   */
  static directionToPosition(from: Position, direction: Direction): Position {
    switch (direction) {
      case Direction.UP:    return { x: from.x,     y: from.y - 1 };
      case Direction.DOWN:  return { x: from.x,     y: from.y + 1 };
      case Direction.LEFT:  return { x: from.x - 1, y: from.y     };
      case Direction.RIGHT: return { x: from.x + 1, y: from.y     };
    }
  }

  /**
   * Get all valid directions the player can move from their current position.
   *
   * Rules:
   * 1. Target cell must be in bounds
   * 2. Target cell must NOT be the immediately previous position (no backtrack)
   * 3. Target cell must NOT be blocked (claimed by another player, or WALL)
   * 4. Target cell must NOT be occupied by another player
   * 5. Test 7: Target cell must be within tether range of teammate
   *
   * @param board - The game board
   * @param currentPos - Player's current position
   * @param playerId - The moving player's ID
   * @param prevPosition - The cell the player just came from (null = first step)
   * @param occupiedPositions - Positions currently occupied by OTHER players
   * @param teammatePosition - Test 7: Position of teammate (null if not spawned)
   * @param tetherLength - Test 7: Maximum allowed tether distance
   */
  static getValidDirections(
    board: Board,
    currentPos: Position,
    playerId: string,
    prevPosition: Position | null,
    occupiedPositions: Position[] = [],
    teammatePosition: Position | null = null,
    tetherLength: number = 999,
  ): Direction[] {
    const allDirections: Direction[] = [
      Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT,
    ];
    const occupiedSet = new Set(occupiedPositions.map(pos => `${pos.x},${pos.y}`));

    return allDirections.filter(direction => {
      const nextPos = MovementValidator.directionToPosition(currentPos, direction);

      // Check 1: in bounds
      if (!board.isInBounds(nextPos.x, nextPos.y)) return false;

      // Check 2: not backtracking to the immediately previous position
      if (prevPosition && nextPos.x === prevPosition.x && nextPos.y === prevPosition.y) {
        return false;
      }

      // Check 3: not blocked by another player's claimed cell or wall
      const cell = board.getCell(nextPos.x, nextPos.y);
      if (!cell || cell.isBlockedFor(playerId)) return false;

      // Check 4: not blocked by another player's current position
      if (occupiedSet.has(`${nextPos.x},${nextPos.y}`)) return false;

      // Check 5 (Test 7): tether constraint
      if (teammatePosition) {
        const distance = GameState.calculateTetherDistance(nextPos, teammatePosition);
        if (distance > tetherLength) return false;
      }

      return true;
    });
  }

  /**
   * Get the actual positions the player can move to (for client highlighting).
   */
  static getHighlightPositions(
    board: Board,
    currentPos: Position,
    playerId: string,
    prevPosition: Position | null,
    occupiedPositions: Position[] = [],
    teammatePosition: Position | null = null,
    tetherLength: number = 999,
  ): Position[] {
    const validDirections = MovementValidator.getValidDirections(
      board, currentPos, playerId, prevPosition, occupiedPositions,
      teammatePosition, tetherLength,
    );
    return validDirections.map(dir =>
      MovementValidator.directionToPosition(currentPos, dir),
    );
  }
}
