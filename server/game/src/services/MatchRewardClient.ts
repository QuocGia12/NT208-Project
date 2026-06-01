import { GameState } from '../game/GameState';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const GAME_SERVER_INTERNAL_SECRET =
  process.env.GAME_SERVER_INTERNAL_SECRET ?? 'dev_internal_secret_change_me';

export const awardMatchRewards = async (
  gameState: GameState,
  winningTeamId: string
): Promise<void> => {
  const winningTeam = gameState.getTeam(winningTeamId);
  if (!winningTeam) {
    console.warn(`[Rewards] Cannot award room ${gameState.roomId}: winning team not found.`);
    return;
  }

  const winnerPlayerIds = [...winningTeam.playerIds];
  const loserPlayerIds = gameState.players
    .filter((player) => player.teamId !== winningTeamId)
    .map((player) => player.id);

  try {
    const response = await fetch(`${API_BASE_URL}/api/internal/matches/reward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-game-server-secret': GAME_SERVER_INTERNAL_SECRET
      },
      body: JSON.stringify({
        roomId: gameState.roomId,
        winnerTeamId: winningTeamId,
        winnerPlayerIds,
        loserPlayerIds
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Rewards] Failed to award room ${gameState.roomId}: ${response.status} ${body}`);
      return;
    }

    console.log(
      `[Rewards] Awarded room ${gameState.roomId}: winners=${winnerPlayerIds.join(',')} losers=${loserPlayerIds.join(',')}`
    );
  } catch (error) {
    console.error(`[Rewards] Failed to reach API for room ${gameState.roomId}:`, error);
  }
};
