import { Router } from 'express';
import { Prisma, ShopItemType } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware';
import { toSafeUser } from '../utils/safe-user';

const shopRouter = Router();

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

const isFrameSkin = (item: { type: ShopItemType; metadata: Prisma.JsonValue | null }) => {
  if (item.type !== ShopItemType.SKIN) return false;
  if (!isRecord(item.metadata) || typeof item.metadata.skinType !== 'string') return true;
  return item.metadata.skinType.toUpperCase() === 'FRAME';
};

shopRouter.get('/items', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Missing authenticated user.' });
    }

    const [items, ownedQuantityMap, user] = await Promise.all([
      prisma.shopItem.findMany({
        where: {
          isActive: true,
          type: {
            in: [ShopItemType.SKIN, ShopItemType.ITEM]
          }
        },
        orderBy: [
          { type: 'asc' },
          { priceCoins: 'asc' },
          { priceGems: 'asc' },
          { name: 'asc' }
        ]
      }),
      getOwnedQuantityMap(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          equippedFrameItemId: true
        }
      })
    ]);

    return res.status(200).json({
      items: items.map((item) => ({
        ...item,
        ownedQuantity: ownedQuantityMap.get(item.id) ?? 0,
        isApplied: item.id === user?.equippedFrameItemId
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

    return res.status(200).json({ cards: [] });
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

      if (item.type === ShopItemType.CARD) {
        throw new HttpError(404, 'Shop item is not available.');
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          equippedFrameItem: {
            select: {
              imageUrl: true
            }
          }
        }
      });

      if (!user) {
        throw new HttpError(404, 'User not found.');
      }

      const existingInventory = await tx.userInventory.findUnique({
        where: {
          userId_itemId: {
            userId,
            itemId: item.id
          }
        }
      });

      if (item.type === ShopItemType.SKIN && existingInventory) {
        return {
          item,
          inventory: existingInventory,
          user,
          alreadyOwned: true
        };
      }

      if (user.coins < item.priceCoins || user.gems < item.priceGems) {
        throw new HttpError(400, 'Not enough coins or gems.');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          coins: { decrement: item.priceCoins },
          gems: { decrement: item.priceGems }
        },
        include: {
          equippedFrameItem: {
            select: {
              imageUrl: true
            }
          }
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
        user: updatedUser,
        alreadyOwned: false
      };
    });

    return res.status(200).json({
      message: result.alreadyOwned ? 'Item already owned.' : 'Purchase successful.',
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

shopRouter.post('/apply', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Missing authenticated user.' });
    }

    const { itemId } = req.body as { itemId?: unknown };
    if (typeof itemId !== 'string' || itemId.trim().length === 0) {
      return res.status(400).json({ error: 'itemId is required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const inventory = await tx.userInventory.findUnique({
        where: {
          userId_itemId: {
            userId,
            itemId: itemId.trim()
          }
        },
        include: {
          item: true
        }
      });

      if (!inventory) {
        throw new HttpError(404, 'You do not own this shop item.');
      }

      if (!isFrameSkin(inventory.item)) {
        throw new HttpError(400, 'Only frame skins can be applied.');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          equippedFrameItemId: inventory.item.id
        },
        include: {
          equippedFrameItem: {
            select: {
              imageUrl: true
            }
          }
        }
      });

      return {
        item: inventory.item,
        user: updatedUser
      };
    });

    return res.status(200).json({
      message: 'Frame applied.',
      user: toSafeUser(result.user),
      item: result.item
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Apply shop frame error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default shopRouter;
