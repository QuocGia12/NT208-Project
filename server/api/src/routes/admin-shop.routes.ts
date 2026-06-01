import { Request, Router } from 'express';
import { Prisma, ShopItemType } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

import { prisma } from '../lib/prisma';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';

const adminShopRouter = Router();

const SHOP_ITEM_TYPES = new Set<string>([
  ShopItemType.SKIN,
  ShopItemType.ITEM
]);
const SKIN_TYPES = new Set(['FRAME']);
const DEFAULT_SKIN_TYPE = 'FRAME';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'shop');
const UPLOAD_URL_PATH = '/uploads/shop';
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

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
    throw new Error('type must be SKIN or ITEM.');
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

const normalizeSkinType = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_SKIN_TYPE;
  }

  if (!isString(value) || !SKIN_TYPES.has(value.toUpperCase())) {
    throw new Error('skinType must be FRAME.');
  }

  return value.toUpperCase();
};

const normalizeItemMetadata = (
  type: ShopItemType,
  metadataValue: unknown,
  skinTypeValue?: unknown
) => {
  if (type !== ShopItemType.SKIN) {
    return normalizeMetadata(metadataValue);
  }

  const skinType = normalizeSkinType(skinTypeValue);
  if (metadataValue === undefined || metadataValue === null) {
    return { skinType } satisfies Prisma.InputJsonObject;
  }

  if (!isRecord(metadataValue)) {
    throw new Error('Skin metadata must be an object.');
  }

  if (metadataValue.skinType !== undefined && normalizeSkinType(metadataValue.skinType) !== skinType) {
    throw new Error('Skin metadata skinType must be FRAME.');
  }

  return {
    ...metadataValue,
    skinType
  } as Prisma.InputJsonObject;
};

const getUploadOrigin = (req: Request) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.length > 0
      ? forwardedProto.split(',')[0].trim()
      : req.protocol;
  return `${protocol}://${req.get('host')}`;
};

const parseDataUrl = (value: unknown) => {
  if (!isString(value)) {
    throw new Error('dataUrl is required.');
  }

  const match = value.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Upload must be a PNG, JPEG, WebP, or GIF data URL.');
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
};

const badRequest = (message: string) => ({ error: message });

adminShopRouter.use(requireAuth, requireAdmin);

adminShopRouter.get('/items', async (_req, res) => {
  try {
    const items = await prisma.shopItem.findMany({
      where: {
        type: {
          in: [ShopItemType.SKIN, ShopItemType.ITEM]
        }
      },
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
    const type = normalizeType(body.type);
    const metadata = normalizeItemMetadata(type, body.metadata, body.skinType);

    const item = await prisma.shopItem.create({
      data: {
        type,
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
    const current = await prisma.shopItem.findUnique({
      where: { id: req.params.id },
      select: { type: true }
    });

    if (!current) {
      return res.status(404).json({ error: 'Shop item not found.' });
    }

    const nextType = body.type !== undefined ? normalizeType(body.type) : current.type;

    if (body.type !== undefined) data.type = nextType;
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
    if (body.metadata !== undefined || body.skinType !== undefined || body.type !== undefined) {
      const metadata = normalizeItemMetadata(nextType, body.metadata, body.skinType);
      if (metadata !== undefined) {
        data.metadata = metadata;
      }
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

adminShopRouter.post('/upload', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const { contentType, buffer } = parseDataUrl(body.dataUrl);
    const extension = IMAGE_EXTENSIONS[contentType];

    if (!extension) {
      return res.status(400).json(badRequest('Unsupported image type.'));
    }

    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(400).json(badRequest('Image must be between 1 byte and 5MB.'));
    }

    const rawFileName = isString(body.fileName) ? body.fileName : 'shop-image';
    const baseName = path
      .basename(rawFileName, path.extname(rawFileName))
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'shop-image';
    const fileName = `${Date.now()}-${crypto.randomUUID()}-${baseName}.${extension}`;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);

    return res.status(201).json({
      imageUrl: `${getUploadOrigin(req)}${UPLOAD_URL_PATH}/${fileName}`
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json(badRequest(error.message));
    }

    console.error('Admin upload shop image error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default adminShopRouter;
