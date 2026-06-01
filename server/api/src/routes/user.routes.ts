import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { prisma } from '../lib/prisma';
import {
  AuthenticatedRequest,
  requireAuth
} from '../middleware/auth.middleware';

const userRouter = Router();
const MIN_PASSWORD_LENGTH = 6;
const SALT_ROUNDS = 12;
const MAX_AVATAR_LENGTH = 512;

const isString = (value: unknown): value is string => typeof value === 'string';

const computeStats = (totalMatches: number, wins: number) => ({
  totalMatches,
  wins,
  winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
});

// GET /api/users/leaderboard — top 50 players by Elo
userRouter.get('/leaderboard', requireAuth, async (_req, res) => {
  try {
    const topUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        avatar: true,
        elo: true
      },
      orderBy: [{ elo: 'desc' }, { createdAt: 'asc' }],
      take: 50
    });

    return res.status(200).json({
      leaderboard: topUsers.map((user, index) => ({
        rank: index + 1,
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        elo: user.elo
      }))
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/users/me — own profile with inventory
userRouter.get('/me', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        inventoryItems: {
          include: {
            item: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const totalMatches = await prisma.matchParticipant.count({
      where: { userId }
    });

    const wins = await prisma.matchHistory.count({
      where: { winnerId: userId }
    });

    const inventory = user.inventoryItems.map((item) => ({
      id: item.id,
      itemId: item.item.id,
      itemType: item.item.type,
      itemCode: item.item.code,
      itemName: item.item.name,
      itemDescription: item.item.description,
      itemImageUrl: item.item.imageUrl,
      itemMetadata: item.item.metadata,
      cardCode: item.item.code,
      cardName: item.item.name,
      cardDescription: item.item.description,
      cardImageUrl: item.item.imageUrl,
      cardRarity:
        typeof item.item.metadata === 'object'
        && item.item.metadata !== null
        && !Array.isArray(item.item.metadata)
        && typeof item.item.metadata.rarity === 'string'
          ? item.item.metadata.rarity
          : 'COMMON',
      quantity: item.quantity
    }));

    return res.status(200).json({
      profile: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        elo: user.elo,
        coins: user.coins,
        gems: user.gems,
        createdAt: user.createdAt.toISOString(),
        stats: computeStats(totalMatches, wins)
      },
      inventory
    });
  } catch (error) {
    console.error('Get own profile error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/users/me/password — change own password
userRouter.patch('/me/password', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.userId!;

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    if (!isString(currentPassword) || !isString(newPassword)) {
      return res.status(400).json({
        error: 'Current password and new password are required.'
      });
    }

    const normalizedCurrentPassword = currentPassword.trim();
    const normalizedNewPassword = newPassword.trim();

    if (normalizedCurrentPassword.length === 0 || normalizedNewPassword.length === 0) {
      return res.status(400).json({
        error: 'Current password and new password are required.'
      });
    }

    if (normalizedNewPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      });
    }

    if (normalizedCurrentPassword === normalizedNewPassword) {
      return res.status(400).json({
        error: 'New password must be different from current password.'
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const matchesCurrentPassword = await bcrypt.compare(
      normalizedCurrentPassword,
      existingUser.passwordHash
    );

    if (!matchesCurrentPassword) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const nextPasswordHash = await bcrypt.hash(normalizedNewPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: nextPasswordHash }
    });

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/users/me/avatar — update own avatar URL
userRouter.patch('/me/avatar', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.userId!;

    const { avatar } = req.body as {
      avatar?: unknown;
    };

    if (avatar !== undefined && avatar !== null && !isString(avatar)) {
      return res.status(400).json({ error: 'Avatar must be a string URL.' });
    }

    const normalizedAvatar = isString(avatar) ? avatar.trim() : '';

    if (normalizedAvatar.length > MAX_AVATAR_LENGTH) {
      return res
        .status(400)
        .json({ error: `Avatar URL must be at most ${MAX_AVATAR_LENGTH} characters.` });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar: normalizedAvatar.length > 0 ? normalizedAvatar : null
      },
      select: {
        id: true,
        username: true,
        avatar: true,
        elo: true,
        coins: true,
        gems: true,
        role: true
      }
    });

    return res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error('Update avatar error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/users/:username — public profile (no inventory)
userRouter.get('/:username', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const normalizedUsername = username.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const totalMatches = await prisma.matchParticipant.count({
      where: { userId: user.id }
    });

    const wins = await prisma.matchHistory.count({
      where: { winnerId: user.id }
    });

    return res.status(200).json({
      profile: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        elo: user.elo,
        coins: user.coins,
        gems: user.gems,
        createdAt: user.createdAt.toISOString(),
        stats: computeStats(totalMatches, wins)
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default userRouter;
