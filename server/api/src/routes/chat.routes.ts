import { FriendshipStatus, type User } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { requireAuth } from '../middleware/auth.middleware';

const chatRouter = Router();

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
const MAX_MESSAGE_LENGTH = 1000;

type BasicUser = Pick<User, 'id' | 'username' | 'avatar' | 'elo' | 'coins' | 'gems'>;

const mapBasicUser = (user: BasicUser) => ({
  id: user.id,
  username: user.username,
  avatar: user.avatar,
  elo: user.elo,
  coins: user.coins,
  gems: user.gems
});

const getPageSize = (rawLimit: unknown) => {
  if (typeof rawLimit !== 'string') {
    return DEFAULT_PAGE_SIZE;
  }

  const parsed = Number.parseInt(rawLimit, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(parsed, MAX_PAGE_SIZE);
};

const areUsersFriends = async (userId: string, friendId: string) => {
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [
        { user1Id: userId, user2Id: friendId },
        { user1Id: friendId, user2Id: userId }
      ]
    },
    select: { id: true }
  });

  return Boolean(friendship);
};

chatRouter.get('/conversations', requireAuth, async (req, res) => {
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
      }
    });

    const friends = acceptedFriendships.map((friendship) =>
      friendship.user1Id === currentUserId ? friendship.user2 : friendship.user1
    );

    const friendById = new Map(friends.map((friend) => [friend.id, friend]));
    const friendIds = Array.from(friendById.keys());

    if (friendIds.length === 0) {
      return res.status(200).json({ conversations: [] });
    }

    const recentMessages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          {
            senderId: currentUserId,
            receiverId: { in: friendIds }
          },
          {
            receiverId: currentUserId,
            senderId: { in: friendIds }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        content: true,
        createdAt: true
      },
      take: 500
    });

    const latestMessageByFriendId = new Map<
      string,
      {
        id: string;
        content: string;
        createdAt: Date;
        isOwnMessage: boolean;
      }
    >();

    for (const message of recentMessages) {
      const friendId =
        message.senderId === currentUserId ? message.receiverId : message.senderId;

      if (!latestMessageByFriendId.has(friendId)) {
        latestMessageByFriendId.set(friendId, {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          isOwnMessage: message.senderId === currentUserId
        });
      }
    }

    const conversations = friendIds
      .map((friendId) => {
        const friend = friendById.get(friendId)!;
        const lastMessage = latestMessageByFriendId.get(friendId);

        return {
          friend: mapBasicUser(friend),
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt.toISOString(),
                isOwnMessage: lastMessage.isOwnMessage
              }
            : null
        };
      })
      .sort((a, b) => {
        const aTime = a.lastMessage ? Date.parse(a.lastMessage.createdAt) : 0;
        const bTime = b.lastMessage ? Date.parse(b.lastMessage.createdAt) : 0;

        if (aTime !== bTime) {
          return bTime - aTime;
        }

        return a.friend.username.localeCompare(b.friend.username);
      });

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error('Fetch conversations error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

chatRouter.get('/messages/:friendId', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;
    const { friendId } = req.params;

    if (!friendId || friendId.trim().length === 0) {
      return res.status(400).json({ error: 'friendId is required.' });
    }

    if (friendId === currentUserId) {
      return res.status(400).json({ error: 'You cannot open a chat with yourself.' });
    }

    const friendExists = await prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true }
    });

    if (!friendExists) {
      return res.status(404).json({ error: 'Friend not found.' });
    }

    const isFriend = await areUsersFriends(currentUserId, friendId);

    if (!isFriend) {
      return res.status(403).json({ error: 'You can only chat with accepted friends.' });
    }

    const limit = getPageSize(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          {
            senderId: currentUserId,
            receiverId: friendId
          },
          {
            senderId: friendId,
            receiverId: currentUserId
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1
          }
        : {}),
      take: limit + 1,
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true
      }
    });

    const hasMore = messages.length > limit;
    const pageItems = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id ?? null : null;

    return res.status(200).json({
      messages: pageItems.reverse().map((message: {
        id: string;
        senderId: string;
        content: string;
        createdAt: Date;
      }) => ({
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        isOwnMessage: message.senderId === currentUserId
      })),
      nextCursor
    });
  } catch (error) {
    console.error('Fetch messages error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

chatRouter.post('/messages/:friendId', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;
    const { friendId } = req.params;
    const { content } = req.body as { content?: unknown };

    if (!friendId || friendId.trim().length === 0) {
      return res.status(400).json({ error: 'friendId is required.' });
    }

    if (friendId === currentUserId) {
      return res.status(400).json({ error: 'You cannot send a message to yourself.' });
    }

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required.' });
    }

    const normalizedContent = content.trim();

    if (normalizedContent.length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    if (normalizedContent.length > MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
    }

    const friendExists = await prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true }
    });

    if (!friendExists) {
      return res.status(404).json({ error: 'Friend not found.' });
    }

    const isFriend = await areUsersFriends(currentUserId, friendId);

    if (!isFriend) {
      return res.status(403).json({ error: 'You can only chat with accepted friends.' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        senderId: currentUserId,
        receiverId: friendId,
        content: normalizedContent
      },
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true
      }
    });

    return res.status(201).json({
      message: {
        id: message.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        isOwnMessage: message.senderId === currentUserId
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default chatRouter;
