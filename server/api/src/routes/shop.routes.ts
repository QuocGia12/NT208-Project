import { Router } from 'express';
import { Prisma, ShopItemType } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware';
import { toSafeUser } from '../utils/safe-user';

const shopRouter = Router();

type CardRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getCardRarity = (metadata: Prisma.JsonValue | null): CardRarity => {
  if (isRecord(metadata) && typeof metadata.rarity === 'string') {
    const rarity = metadata.rarity.toUpperCase();
    if (rarity === 'COMMON' || rarity === 'RARE' || rarity === 'EPIC' || rarity === 'LEGENDARY') {
      return rarity;
    }
  }

  return 'COMMON';
};

const getOwnedQuantityMap = async (userId: string) => {
  const inventory = await prisma.userInventory.findMany({
    where: { userId },
    select: {
      itemId: true,
      quantity: true
    }
  });

  return new Map(inventory.map((entry) => [entry.itemId, entry.quantity]));
};

shopRouter.get('/items', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Missing authenticated user.' });
    }

    const [items, ownedQuantityMap] = await Promise.all([
      prisma.shopItem.findMany({
        where: { isActive: true },
        orderBy: [
          { type: 'asc' },
          { priceCoins: 'asc' },
          { priceGems: 'asc' },
          { name: 'asc' }
        ]
      }),
      getOwnedQuantityMap(userId)
    ]);

    return res.status(200).json({
      items: items.map((item) => ({
        ...item,
        ownedQuantity: ownedQuantityMap.get(item.id) ?? 0
      }))
    });
  } catch (error) {
    console.error('Fetch shop items error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

shopRouter.get('/cards', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Missing authenticated user.' });
    }

    const [items, ownedQuantityMap] = await Promise.all([
      prisma.shopItem.findMany({
        where: {
          isActive: true,
          type: ShopItemType.CARD
        },
        orderBy: [
          { priceCoins: 'asc' },
          { priceGems: 'asc' },
          { name: 'asc' }
        ]
      }),
      getOwnedQuantityMap(userId)
    ]);

    return res.status(200).json({
      cards: items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        rarity: getCardRarity(item.metadata),
        priceCoins: item.priceCoins,
        priceGems: item.priceGems,
        ownedQuantity: ownedQuantityMap.get(item.id) ?? 0
      }))
    });
  } catch (error) {
    console.error('Fetch shop cards error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

shopRouter.post('/buy', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Missing authenticated user.' });
    }

    const { itemId, cardId } = req.body as { itemId?: unknown; cardId?: unknown };
    const requestedItemId = typeof itemId === 'string' ? itemId : typeof cardId === 'string' ? cardId : null;

    if (!requestedItemId) {
      return res.status(400).json({ error: 'itemId is required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.shopItem.findUnique({
        where: { id: requestedItemId }
      });

      if (!item || !item.isActive) {
        throw new HttpError(404, 'Shop item is not available.');
      }

      const user = await tx.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new HttpError(404, 'User not found.');
      }

      if (user.coins < item.priceCoins || user.gems < item.priceGems) {
        throw new HttpError(400, 'Not enough coins or gems.');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: { decrement: item.priceCoins },
          gems: { decrement: item.priceGems }
        }
      });

      const inventory = await tx.userInventory.upsert({
        where: {
          userId_itemId: {
            userId,
            itemId: item.id
          }
        },
        create: {
          userId,
          itemId: item.id,
          quantity: 1
        },
        update: {
          quantity: { increment: 1 }
        }
      });

      return {
        item,
        inventory,
        user: updatedUser
      };
    });

    return res.status(200).json({
      message: 'Purchase successful.',
      user: toSafeUser(result.user),
      purchase: {
        itemId: result.item.id,
        itemName: result.item.name,
        itemType: result.item.type,
        cardId: result.item.id,
        cardName: result.item.name,
        priceCoins: result.item.priceCoins,
        priceGems: result.item.priceGems,
        ownedQuantity: result.inventory.quantity
      }
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Buy shop item error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default shopRouter;
