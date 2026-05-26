import { CardRarity } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../lib/prisma';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { toSafeUser } from '../utils/safe-user';

const shopRouter = Router();

const rarityRank: Record<CardRarity, number> = {
  COMMON: 0,
  RARE: 1,
  EPIC: 2,
  LEGENDARY: 3
};

const isString = (value: unknown): value is string => typeof value === 'string';

shopRouter.get('/cards', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;

    const cards = await prisma.card.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        imageUrl: true,
        rarity: true,
        priceCoins: true,
        priceGems: true
      },
      orderBy: [{ rarity: 'desc' }, { name: 'asc' }]
    });

    const inventory = await prisma.userInventory.findMany({
      where: {
        userId: currentUserId,
        cardId: { in: cards.map((card) => card.id) }
      },
      select: {
        cardId: true,
        quantity: true
      }
    });

    const quantityByCardId = new Map<string, number>();
    for (const item of inventory) {
      quantityByCardId.set(item.cardId, item.quantity);
    }

    const sortedCards = [...cards].sort((a, b) => {
      const rarityDiff = rarityRank[b.rarity] - rarityRank[a.rarity];
      if (rarityDiff !== 0) {
        return rarityDiff;
      }

      const coinDiff = b.priceCoins - a.priceCoins;
      if (coinDiff !== 0) {
        return coinDiff;
      }

      const gemDiff = b.priceGems - a.priceGems;
      if (gemDiff !== 0) {
        return gemDiff;
      }

      return a.name.localeCompare(b.name);
    });

    return res.status(200).json({
      cards: sortedCards.map((card) => ({
        ...card,
        ownedQuantity: quantityByCardId.get(card.id) ?? 0
      }))
    });
  } catch (error) {
    console.error('Fetch shop cards error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

shopRouter.post('/buy', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserId = authReq.userId!;

    const { cardId } = req.body as { cardId?: unknown };

    if (!isString(cardId) || cardId.trim().length === 0) {
      return res.status(400).json({ error: 'cardId is required.' });
    }

    const targetCardId = cardId.trim();

    const purchaseResult = await prisma.$transaction(async (tx) => {
      const [user, card] = await Promise.all([
        tx.user.findUnique({ where: { id: currentUserId } }),
        tx.card.findFirst({ where: { id: targetCardId, isActive: true } })
      ]);

      if (!user) {
        return { error: 'USER_NOT_FOUND' as const };
      }

      if (!card) {
        return { error: 'CARD_NOT_FOUND' as const };
      }

      if (user.coins < card.priceCoins || user.gems < card.priceGems) {
        return { error: 'INSUFFICIENT_FUNDS' as const, card, user };
      }

      const [updatedUser, inventoryItem] = await Promise.all([
        tx.user.update({
          where: { id: currentUserId },
          data: {
            coins: { decrement: card.priceCoins },
            gems: { decrement: card.priceGems }
          }
        }),
        tx.userInventory.upsert({
          where: {
            userId_cardId: {
              userId: currentUserId,
              cardId: card.id
            }
          },
          create: {
            userId: currentUserId,
            cardId: card.id,
            quantity: 1
          },
          update: {
            quantity: { increment: 1 }
          }
        })
      ]);

      return {
        error: null,
        card,
        updatedUser,
        inventoryItem
      };
    });

    if (purchaseResult.error === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (purchaseResult.error === 'CARD_NOT_FOUND') {
      return res.status(404).json({ error: 'Card not found or unavailable.' });
    }

    if (purchaseResult.error === 'INSUFFICIENT_FUNDS') {
      return res.status(400).json({
        error: 'Not enough currencies to buy this card.',
        required: {
          coins: purchaseResult.card.priceCoins,
          gems: purchaseResult.card.priceGems
        },
        current: {
          coins: purchaseResult.user.coins,
          gems: purchaseResult.user.gems
        }
      });
    }

    return res.status(200).json({
      message: 'Purchase successful.',
      user: toSafeUser(purchaseResult.updatedUser),
      purchase: {
        cardId: purchaseResult.card.id,
        cardName: purchaseResult.card.name,
        priceCoins: purchaseResult.card.priceCoins,
        priceGems: purchaseResult.card.priceGems,
        ownedQuantity: purchaseResult.inventoryItem.quantity
      }
    });
  } catch (error) {
    console.error('Purchase card error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default shopRouter;
