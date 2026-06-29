import { Request, Router } from 'express';
import { Prisma, ShopItemType } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { unzipSync } from 'fflate';

import { prisma } from '../lib/prisma';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';

const adminShopRouter = Router();

const SHOP_ITEM_TYPES = new Set<string>([
  ShopItemType.SKIN,
  ShopItemType.ITEM
]);
const SKIN_TYPES = new Set(['FRAME', 'DICE', 'MAP']);
const ITEM_TYPES = new Set(['STANDARD', 'COIN_PACK']);
const DEFAULT_SKIN_TYPE = 'FRAME';
const DEFAULT_ITEM_TYPE = 'STANDARD';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_MAP_UPLOAD_BYTES = 20 * 1024 * 1024;
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'shop');
const MAP_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'shop', 'maps');
const UPLOAD_URL_PATH = '/uploads/shop';
const MAP_UPLOAD_URL_PATH = '/uploads/shop/maps';
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
const MAP_ZODIAC_KEYS = [
  'ty',
  'suu',
  'dan',
  'mao',
  'thin',
  'ti',
  'ngo',
  'mui',
  'than',
  'dau',
  'tuat',
  'hoi'
] as const;
const MAP_REQUIRED_FILES = [
  'add-card.png',
  'ty.png',
  'suu.png',
  'dan.png',
  'mao.png',
  'thin.png',
  'ti.png',
  'ngo.png',
  'mui.png',
  'than.png',
  'dau.png',
  'tuat.png',
  'hoi.png',
  'preview.png'
] as const;
const MAP_ZODIAC_FILE_NAMES = {
  ty: 'ty.png',
  suu: 'suu.png',
  dan: 'dan.png',
  mao: 'mao.png',
  thin: 'thin.png',
  ti: 'ti.png',
  ngo: 'ngo.png',
  mui: 'mui.png',
  than: 'than.png',
  dau: 'dau.png',
  tuat: 'tuat.png',
  hoi: 'hoi.png'
} as const;
const ZIP_CONTENT_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream'
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
    throw new Error('skinType must be FRAME, DICE, or MAP.');
  }

  return value.toUpperCase();
};

const normalizeShopItemKind = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_ITEM_TYPE;
  }

  if (!isString(value) || !ITEM_TYPES.has(value.toUpperCase())) {
    throw new Error('itemKind must be STANDARD or COIN_PACK.');
  }

  return value.toUpperCase();
};

const normalizeRewardCoins = (value: unknown) => {
  const rewardCoins = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(rewardCoins) || rewardCoins <= 0) {
    throw new Error('rewardCoins must be a positive integer.');
  }

  return rewardCoins;
};

const normalizeMapAssets = (value: unknown) => {
  if (!isRecord(value)) {
    throw new Error('Map skin metadata must include mapAssets.');
  }

  const previewImageUrl = normalizeRequiredString(value.previewImageUrl, 'mapAssets.previewImageUrl');
  const addCardImageUrl = normalizeRequiredString(value.addCardImageUrl, 'mapAssets.addCardImageUrl');
  if (!isRecord(value.zodiacBoxImageUrls)) {
    throw new Error('mapAssets.zodiacBoxImageUrls must be an object.');
  }

  const zodiacBoxImageUrls = {} as Record<(typeof MAP_ZODIAC_KEYS)[number], string>;
  for (const key of MAP_ZODIAC_KEYS) {
    zodiacBoxImageUrls[key] = normalizeRequiredString(
      value.zodiacBoxImageUrls[key],
      `mapAssets.zodiacBoxImageUrls.${key}`
    );
  }

  return {
    previewImageUrl,
    addCardImageUrl,
    zodiacBoxImageUrls
  } satisfies Prisma.InputJsonObject;
};

const normalizeItemMetadata = (
  type: ShopItemType,
  metadataValue: unknown,
  skinTypeValue?: unknown,
  itemKindValue?: unknown
) => {
  if (type !== ShopItemType.SKIN) {
    const itemKind = normalizeShopItemKind(itemKindValue);
    if (itemKind !== 'COIN_PACK') {
      return metadataValue === undefined ? undefined : normalizeMetadata(metadataValue);
    }

    if (!isRecord(metadataValue)) {
      throw new Error('COIN_PACK item requires metadata.');
    }

    const metadataItemKind = normalizeShopItemKind(metadataValue.itemType);
    if (metadataItemKind !== 'COIN_PACK') {
      throw new Error('COIN_PACK metadata itemType must be COIN_PACK.');
    }

    return {
      itemType: 'COIN_PACK',
      rewardCoins: normalizeRewardCoins(metadataValue.rewardCoins)
    } satisfies Prisma.InputJsonObject;
  }

  const skinType = normalizeSkinType(skinTypeValue);
  if (metadataValue === undefined || metadataValue === null) {
    if (skinType === 'MAP') {
      throw new Error('MAP skin requires uploaded map metadata.');
    }

    return { skinType } satisfies Prisma.InputJsonObject;
  }

  if (!isRecord(metadataValue)) {
    throw new Error('Skin metadata must be an object.');
  }

  if (metadataValue.skinType !== undefined && normalizeSkinType(metadataValue.skinType) !== skinType) {
    throw new Error('Skin metadata skinType must match FRAME, DICE, or MAP.');
  }

  if (skinType === 'MAP') {
    return {
      ...metadataValue,
      skinType,
      mapAssets: normalizeMapAssets(metadataValue.mapAssets)
    } as Prisma.InputJsonObject;
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

const parseZipDataUrl = (value: unknown) => {
  if (!isString(value)) {
    throw new Error('dataUrl is required.');
  }

  const match = value.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !ZIP_CONTENT_TYPES.has(match[1])) {
    throw new Error('Upload must be a ZIP data URL.');
  }

  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
};

const sanitizePathSegment = (value: string, fallback: string) => {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return sanitized || fallback;
};

const buildUploadUrl = (req: Request, relativePath: string) =>
  `${getUploadOrigin(req)}${relativePath}`;

const normalizeZipEntries = (buffer: Buffer) => {
  const archive = unzipSync(new Uint8Array(buffer));
  const normalizedEntries = new Map<string, Uint8Array>();

  for (const [entryName, entryBuffer] of Object.entries(archive)) {
    const normalizedName = path.basename(entryName).toLowerCase();
    if (!normalizedName || normalizedName.startsWith('.')) {
      continue;
    }

    if (normalizedEntries.has(normalizedName)) {
      throw new Error(`Duplicate file in zip: ${normalizedName}`);
    }

    normalizedEntries.set(normalizedName, entryBuffer);
  }

  return normalizedEntries;
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
    const metadata = normalizeItemMetadata(type, body.metadata, body.skinType, body.itemKind);

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
      const metadata = normalizeItemMetadata(nextType, body.metadata, body.skinType, body.itemKind);
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

adminShopRouter.post('/upload-map', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const code = normalizeRequiredString(body.code, 'code');
    const { buffer } = parseZipDataUrl(body.dataUrl);

    if (buffer.length === 0 || buffer.length > MAX_MAP_UPLOAD_BYTES) {
      return res.status(400).json(badRequest('Map zip must be between 1 byte and 20MB.'));
    }

    const entries = normalizeZipEntries(buffer);
    const unexpectedFiles = [...entries.keys()].filter((fileName) => !MAP_REQUIRED_FILES.includes(fileName as typeof MAP_REQUIRED_FILES[number]));
    if (unexpectedFiles.length > 0) {
      return res.status(400).json(
        badRequest(`Unexpected files in zip: ${unexpectedFiles.join(', ')}`)
      );
    }

    const missingFiles = MAP_REQUIRED_FILES.filter((fileName) => !entries.has(fileName));
    if (missingFiles.length > 0) {
      return res.status(400).json(
        badRequest(`Missing required map files: ${missingFiles.join(', ')}`)
      );
    }

    const folderName = sanitizePathSegment(code, 'map-skin');
    const targetDir = path.join(MAP_UPLOAD_DIR, folderName);
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });

    for (const fileName of MAP_REQUIRED_FILES) {
      const fileBuffer = entries.get(fileName);
      if (!fileBuffer || fileBuffer.byteLength === 0) {
        return res.status(400).json(badRequest(`Invalid or empty file: ${fileName}`));
      }

      await fs.writeFile(path.join(targetDir, fileName), Buffer.from(fileBuffer));
    }

    const baseRelativePath = `${MAP_UPLOAD_URL_PATH}/${folderName}`;
    const metadata = {
      skinType: 'MAP',
      mapAssets: {
        previewImageUrl: buildUploadUrl(req, `${baseRelativePath}/preview.png`),
        addCardImageUrl: buildUploadUrl(req, `${baseRelativePath}/add-card.png`),
        zodiacBoxImageUrls: Object.fromEntries(
          MAP_ZODIAC_KEYS.map((key) => [
            key,
            buildUploadUrl(req, `${baseRelativePath}/${MAP_ZODIAC_FILE_NAMES[key]}`)
          ])
        )
      }
    } satisfies Prisma.InputJsonObject;

    return res.status(201).json({
      imageUrl: buildUploadUrl(req, `${baseRelativePath}/preview.png`),
      metadata
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json(badRequest(error.message));
    }

    console.error('Admin upload map skin error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default adminShopRouter;
