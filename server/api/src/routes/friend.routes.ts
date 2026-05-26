import { FriendshipStatus, type User } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { requireAuth } from '../middleware/auth.middleware';

const friendRouter = Router();

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_RESULTS = 20;

type FriendRelationshipStatus =
  | 'NONE'
  | 'PENDING_INCOMING'
  | 'PENDING_OUTGOING'
  | 'FRIENDS';

type BasicUser = Pick<User, 'id' | 'username' | 'avatar' | 'elo' | 'coins' | 'gems'>;

const relationshipPriority: Record<FriendRelationshipStatus, number> = {
  NONE: 0,
  PENDING_OUTGOING: 1,
  PENDING_INCOMING: 2,
  FRIENDS: 3
};

const isString = (value: unknown): value is string => typeof value === 'string';

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const mapBasicUser = (user: BasicUser) => ({
  id: user.id,
  username: user.username,
  avatar: user.avatar,
  elo: user.elo,
  coins: user.coins,
  gems: user.gems
});

const deriveRelationship = (
  status: FriendshipStatus,
  isOutgoing: boolean
): FriendRelationshipStatus => {
  if (status === FriendshipStatus.ACCEPTED) {
    return 'FRIENDS';
  }

  return isOutgoing ? 'PENDING_OUTGOING' : 'PENDING_INCOMING';
};

friendRouter.get('/search', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;

    const rawQuery = isString(req.query.query)
      ? req.query.query.trim()
      : '';

    if (rawQuery.length < MIN_SEARCH_LENGTH) {
      return res.status(200).json({ results: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        username: {
          contains: normalizeUsername(rawQuery),
          mode: 'insensitive'
        }
      },
      orderBy: { username: 'asc' },
      select: {
        id: true,
        username: true,
        avatar: true,
        elo: true,
        coins: true,
        gems: true
      },
      take: MAX_SEARCH_RESULTS
    });

    if (users.length === 0) {
      return res.status(200).json({ results: [] });
    }

    const searchedUserIds = users.map((user) => user.id);

    const relatedFriendships = await prisma.friendship.findMany({
      where: {
        OR: [
          {
            user1Id: currentUserId,
            user2Id: { in: searchedUserIds }
          },
          {
            user2Id: currentUserId,
            user1Id: { in: searchedUserIds }
          }
        ]
      },
      select: {
        user1Id: true,
        user2Id: true,
        status: true
      }
    });

    const relationshipByUserId = new Map<string, FriendRelationshipStatus>();

    for (const friendship of relatedFriendships) {
      const isOutgoing = friendship.user1Id === currentUserId;
      const otherUserId = isOutgoing ? friendship.user2Id : friendship.user1Id;
      const nextStatus = deriveRelationship(friendship.status, isOutgoing);
      const existingStatus = relationshipByUserId.get(otherUserId) ?? 'NONE';

      if (relationshipPriority[nextStatus] > relationshipPriority[existingStatus]) {
        relationshipByUserId.set(otherUserId, nextStatus);
      }
    }

    return res.status(200).json({
      results: users.map((user) => ({
        ...mapBasicUser(user),
        relationshipStatus: relationshipByUserId.get(user.id) ?? 'NONE'
      }))
    });
  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

friendRouter.post('/requests', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;

    const { targetUserId, targetUsername } = req.body as {
      targetUserId?: unknown;
      targetUsername?: unknown;
    };

    if (!isString(targetUserId) && !isString(targetUsername)) {
      return res.status(400).json({ error: 'targetUserId or targetUsername is required.' });
    }

    let targetUser: BasicUser | null = null;

    if (isString(targetUserId)) {
      targetUser = await prisma.user.findUnique({
        where: { id: targetUserId.trim() },
        select: {
          id: true,
          username: true,
          avatar: true,
          elo: true,
          coins: true,
          gems: true
        }
      });
    } else if (isString(targetUsername)) {
      targetUser = await prisma.user.findUnique({
        where: { username: normalizeUsername(targetUsername) },
        select: {
          id: true,
          username: true,
          avatar: true,
          elo: true,
          coins: true,
          gems: true
        }
      });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found.' });
    }

    if (targetUser.id === currentUserId) {
      return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
    }

    const existingFriendships = await prisma.friendship.findMany({
      where: {
        OR: [
          {
            user1Id: currentUserId,
            user2Id: targetUser.id
          },
          {
            user1Id: targetUser.id,
            user2Id: currentUserId
          }
        ]
      },
      select: {
        user1Id: true,
        user2Id: true,
        status: true
      }
    });

    const accepted = existingFriendships.find(
      (friendship) => friendship.status === FriendshipStatus.ACCEPTED
    );

    if (accepted) {
      return res.status(409).json({ error: 'You are already friends with this user.' });
    }

    const outgoingPending = existingFriendships.find(
      (friendship) =>
        friendship.status === FriendshipStatus.PENDING &&
        friendship.user1Id === currentUserId
    );

    if (outgoingPending) {
      return res.status(409).json({ error: 'Friend request already sent.' });
    }

    const incomingPending = existingFriendships.find(
      (friendship) =>
        friendship.status === FriendshipStatus.PENDING &&
        friendship.user2Id === currentUserId
    );

    if (incomingPending) {
      return res.status(409).json({
        error:
          'This user already sent you a request. Accept or decline it in Pending Requests.'
      });
    }

    const createdRequest = await prisma.friendship.create({
      data: {
        user1Id: currentUserId,
        user2Id: targetUser.id,
        status: FriendshipStatus.PENDING
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });

    return res.status(201).json({
      request: {
        id: createdRequest.id,
        status: createdRequest.status,
        createdAt: createdRequest.createdAt.toISOString(),
        toUser: mapBasicUser(targetUser)
      }
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

friendRouter.get('/requests/pending', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;

    const pendingRequests = await prisma.friendship.findMany({
      where: {
        user2Id: currentUserId,
        status: FriendshipStatus.PENDING
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            avatar: true,
            elo: true,
            coins: true,
            gems: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      requests: pendingRequests.map((request) => ({
        id: request.id,
        createdAt: request.createdAt.toISOString(),
        fromUser: mapBasicUser(request.user1)
      }))
    });
  } catch (error) {
    console.error('Fetch pending requests error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

friendRouter.patch('/requests/:requestId', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;
    const { requestId } = req.params;
    const { action } = req.body as { action?: unknown };

    if (action !== 'accept' && action !== 'decline') {
      return res.status(400).json({ error: 'Action must be either accept or decline.' });
    }

    const existingRequest = await prisma.friendship.findFirst({
      where: {
        id: requestId,
        user2Id: currentUserId,
        status: FriendshipStatus.PENDING
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            avatar: true,
            elo: true,
            coins: true,
            gems: true
          }
        }
      }
    });

    if (!existingRequest) {
      return res.status(404).json({ error: 'Friend request not found.' });
    }

    if (action === 'accept') {
      await prisma.friendship.update({
        where: { id: requestId },
        data: {
          status: FriendshipStatus.ACCEPTED
        }
      });

      return res.status(200).json({
        message: 'Friend request accepted.',
        friend: mapBasicUser(existingRequest.user1)
      });
    }

    await prisma.friendship.delete({
      where: { id: requestId }
    });

    return res.status(200).json({
      message: 'Friend request declined.',
      requestId
    });
  } catch (error) {
    console.error('Respond friend request error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

friendRouter.get('/', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;

    const acceptedFriendships = await prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }]
      },
      include: {
        user1: {
          select: {
            id: true,
            username: true,
            avatar: true,
            elo: true,
            coins: true,
            gems: true
          }
        },
        user2: {
          select: {
            id: true,
            username: true,
            avatar: true,
            elo: true,
            coins: true,
            gems: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const seenFriendIds = new Set<string>();
    const friends: ReturnType<typeof mapBasicUser>[] = [];

    for (const friendship of acceptedFriendships) {
      const friend =
        friendship.user1Id === currentUserId
          ? friendship.user2
          : friendship.user1;

      if (!seenFriendIds.has(friend.id)) {
        seenFriendIds.add(friend.id);
        friends.push(mapBasicUser(friend));
      }
    }

    return res.status(200).json({ friends });
  } catch (error) {
    console.error('Fetch friends error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default friendRouter;
