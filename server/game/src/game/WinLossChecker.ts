// ============================================================
// WinLossChecker — Static utility for win/loss condition checking.
// No instance state. All methods are static.
// Test 7: Team-based win (10 cells), respawn-on-stuck.
// ============================================================

import { Board } from './Board';
import { Player } from './Player';
import { TeamInfo, TEAM_WIN_CELL_COUNT } from '../types';

export class WinLossChecker {
  /**
   * Test 7: Check if any team has won (claimed all 10 cells: 5 per player × 2).
   * Returns the winning teamId, or null if no winner yet.
   */
  static checkTeamWin(teams: TeamInfo[]): string | null {
    for (const team of teams) {
      if (team.totalClaimed >= TEAM_WIN_CELL_COUNT) {
        return team.teamId;
      }
    }
    return null;
  }

  /* TEST7_DISABLED: Individual win/loss no longer used
  static checkWin(players: Player[]): string | null {
    // Condition 1: Claimed 9 cells
    for (const player of players) {
      if (player.claimedCount === 9) {
        return player.id;
      }
    }

    // Condition 2: Last man standing
    const activePlayers = players.filter(p => !p.eliminated);
    if (activePlayers.length === 1 && players.length > 1) {
      return activePlayers[0].id;
    }

    return null;
  }
  */

  /**
   * Test 7: Check if any player is stuck (cannot move).
   * Returns array of stuck player IDs.
   * This triggers respawn flow, NOT permanent elimination.
   */
  static checkStuck(
    players: Player[],
    board: Board,
  ): string[] {
    const stuckPlayers: string[] = [];

    for (const player of players) {
      // Skip players who haven't spawned yet
      if (!player.hasSpawned) continue;

      const occupiedByOthers = players
        .filter(other => other.id !== player.id && other.hasSpawned)
        .map(other => ({ x: other.position.x, y: other.position.y }));

      if (player.isStuck(board, occupiedByOthers)) {
        stuckPlayers.push(player.id);
      }
    }

    return stuckPlayers;
  }

  /* TEST7_DISABLED: Permanent elimination no longer used
  static checkElimination(
    players: Player[],
    board: Board,
    eliminatedPlayers: string[],
  ): string[] {
    const newlyEliminated: string[] = [];

    for (const player of players) {
      if (player.eliminated || eliminatedPlayers.includes(player.id) || !player.hasSpawned) {
        continue;
      }

      const occupiedByOthers = players
        .filter(other => other.id !== player.id && other.hasSpawned && !other.eliminated)
        .map(other => ({ x: other.position.x, y: other.position.y }));

      if (player.isStuck(board, occupiedByOthers)) {
        newlyEliminated.push(player.id);
      }
    }

    return newlyEliminated;
  }
  */
}
