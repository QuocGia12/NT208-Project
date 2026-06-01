import { Router } from 'express';
import { Prisma, ShopItemType } from '@prisma/client';

import { prisma } from '../lib/prisma';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';

const adminShopRouter = Router();

const SHOP_ITEM_TYPES = new Set<string>([
  ShopItemType.CARD,
  ShopItemType.SKIN,
  ShopItemType.ITEM
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const normalizeOptionalString = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!isString(value)) {
    throw new Error('Expected a string.');
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeRequiredString = (value: unknown, fieldName: string) => {
  if (!isString(value) || value.trim().length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
};

const normalizePrice = (value: unknown, fieldName: string) => {
  if (value === undefined) return undefined;
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return numberValue;
};

const normalizeType = (value: unknown) => {
  if (!isString(value) || !SHOP_ITEM_TYPES.has(value)) {
    throw new Error('type must be CARD, SKIN, or ITEM.');
  }

  return value as ShopItemType;
};

const normalizeMetadata = (value: unknown) => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  if (!isRecord(value) && !Array.isArray(value)) {
    throw new Error('metadata must be an object, array, or null.');
  }

  return value as Prisma.InputJsonValue;
};

const badRequest = (message: string) => ({ error: message });

adminShopRouter.use(requireAuth, requireAdmin);

adminShopRouter.get('/items', async (_req, res) => {
  try {
    const items = await prisma.shopItem.findMany({
      orderBy: [{ createdAt: 'desc' }]
    });

    return res.status(200).json({ items });
  } catch (error) {
    console.error('Admin fetch shop items error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

adminShopRouter.post('/items', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const metadata = normalizeMetadata(body.metadata);

    const item = await prisma.shopItem.create({
      data: {
        type: normalizeType(body.type),
        code: normalizeRequiredString(body.code, 'code'),
        name: normalizeRequiredString(body.name, 'name'),
        description: normalizeOptionalString(body.description),
        imageUrl: normalizeOptionalString(body.imageUrl),
        priceCoins: normalizePrice(body.priceCoins, 'priceCoins') ?? 0,
        priceGems: normalizePrice(body.priceGems, 'priceGems') ?? 0,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
        ...(metadata !== undefined ? { metadata } : {})
      }
    });

    return res.status(201).json({ item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Shop item code already exists.' });
    }

    if (error instanceof Error) {
      return res.status(400).json(badRequest(error.message));
    }

    console.error('Admin create shop item error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

adminShopRouter.patch('/items/:id', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const data: Prisma.ShopItemUpdateInput = {};

    if (body.type !== undefined) data.type = normalizeType(body.type);
    if (body.code !== undefined) data.code = normalizeRequiredString(body.code, 'code');
    if (body.name !== undefined) data.name = normalizeRequiredString(body.name, 'name');
    if (body.description !== undefined) data.description = normalizeOptionalString(body.description);
    if (body.imageUrl !== undefined) data.imageUrl = normalizeOptionalString(body.imageUrl);
    if (body.priceCoins !== undefined) data.priceCoins = normalizePrice(body.priceCoins, 'priceCoins');
    if (body.priceGems !== undefined) data.priceGems = normalizePrice(body.priceGems, 'priceGems');
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return res.status(400).json(badRequest('isActive must be boolean.'));
      }
      data.isActive = body.isActive;
    }
    if (body.metadata !== undefined) {
      data.metadata = normalizeMetadata(body.metadata);
    }

    const item = await prisma.shopItem.update({
      where: { id: req.params.id },
      data
    });

    return res.status(200).json({ item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Shop item not found.' });
      }
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'Shop item code already exists.' });
      }
    }

    if (error instanceof Error) {
      return res.status(400).json(badRequest(error.message));
    }

    console.error('Admin update shop item error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

adminShopRouter.patch('/items/:id/toggle-active', async (req, res) => {
  try {
    const body = req.body as { isActive?: unknown };
    const current = await prisma.shopItem.findUnique({
      where: { id: req.params.id },
      select: { isActive: true }
    });

    if (!current) {
      return res.status(404).json({ error: 'Shop item not found.' });
    }

    if (body.isActive !== undefined && typeof body.isActive !== 'boolean') {
      return res.status(400).json(badRequest('isActive must be boolean.'));
    }

    const item = await prisma.shopItem.update({
      where: { id: req.params.id },
      data: {
        isActive: typeof body.isActive === 'boolean' ? body.isActive : !current.isActive
      }
    });

    return res.status(200).json({ item });
  } catch (error) {
    console.error('Admin toggle shop item error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

adminShopRouter.delete('/items/:id', async (req, res) => {
  try {
    await prisma.shopItem.delete({
      where: { id: req.params.id }
    });

    return res.status(200).json({ message: 'Shop item deleted.' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'Shop item not found.' });
    }

    console.error('Admin delete shop item error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default adminShopRouter;
