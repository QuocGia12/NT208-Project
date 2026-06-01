import { Router } from 'express';

import { prisma } from '../lib/prisma';

const internalMatchRouter = Router();

const GAME_REWARD = {
  winnerCoins: 10,
  winnerGems: 1,
  winnerElo: 200,
  loserCoins: 2
} as const;

const internalSecret = process.env.GAME_SERVER_INTERNAL_SECRET ?? 'dev_internal_secret_change_me';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);

internalMatchRouter.use((req, res, next) => {
  const providedSecret = req.header('x-game-server-secret');
  if (!providedSecret || providedSecret !== internalSecret) {
    return res.status(403).json({ error: 'Invalid internal secret.' });
  }

  next();
});

internalMatchRouter.post('/reward', async (req, res) => {
  try {
    const { roomId, winnerPlayerIds, loserPlayerIds } = req.body as {
      roomId?: unknown;
      winnerPlayerIds?: unknown;
      loserPlayerIds?: unknown;
    };

    if (!isStringArray(winnerPlayerIds) || !isStringArray(loserPlayerIds)) {
      return res.status(400).json({ error: 'winnerPlayerIds and loserPlayerIds are required.' });
    }

    const uniqueWinnerIds = Array.from(new Set(winnerPlayerIds));
    const uniqueLoserIds = Array.from(new Set(loserPlayerIds));
    const winnerSet = new Set(uniqueWinnerIds);
    const duplicateAcrossTeams = uniqueLoserIds.some((playerId) => winnerSet.has(playerId));

    if (duplicateAcrossTeams) {
      return res.status(400).json({ error: 'A player cannot be both winner and loser.' });
    }

    const allPlayerIds = [...uniqueWinnerIds, ...uniqueLoserIds];
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: allPlayerIds } },
      select: { id: true }
    });
    const existingUserIds = new Set(existingUsers.map((user) => user.id));
    const existingWinnerIds = uniqueWinnerIds.filter((playerId) => existingUserIds.has(playerId));
    const existingLoserIds = uniqueLoserIds.filter((playerId) => existingUserIds.has(playerId));

    await prisma.$transaction([
      prisma.user.updateMany({
        where: { id: { in: existingWinnerIds } },
        data: {
          coins: { increment: GAME_REWARD.winnerCoins },
          gems: { increment: GAME_REWARD.winnerGems },
          elo: { increment: GAME_REWARD.winnerElo }
        }
      }),
      prisma.user.updateMany({
        where: { id: { in: existingLoserIds } },
        data: {
          coins: { increment: GAME_REWARD.loserCoins }
        }
      })
    ]);

    return res.status(200).json({
      rewards: {
        roomId: typeof roomId === 'string' ? roomId : null,
        winners: {
          playerIds: existingWinnerIds,
          coins: GAME_REWARD.winnerCoins,
          gems: GAME_REWARD.winnerGems,
          elo: GAME_REWARD.winnerElo
        },
        losers: {
          playerIds: existingLoserIds,
          coins: GAME_REWARD.loserCoins,
          gems: 0,
          elo: 0
        },
        skippedPlayerIds: allPlayerIds.filter((playerId) => !existingUserIds.has(playerId))
      }
    });
  } catch (error) {
    console.error('Reward match error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default internalMatchRouter;
