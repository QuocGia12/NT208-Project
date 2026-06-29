import { ShopItem, User, UserRole } from '@prisma/client';

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

type MapZodiacKey = (typeof MAP_ZODIAC_KEYS)[number];

export type EquippedMapAssets = {
  previewImageUrl: string;
  addCardImageUrl: string;
  zodiacBoxImageUrls: Record<MapZodiacKey, string>;
};

export type SafeUser = {
  id: string;
  username: string;
  avatar: string | null;
  elo: number;
  coins: number;
  gems: number;
  role: UserRole;
  equippedFrameItemId: string | null;
  equippedFrameImageUrl: string | null;
  equippedDiceItemId: string | null;
  equippedDicePanelImageUrl: string | null;
  equippedMapItemId: string | null;
  equippedMapAssets: EquippedMapAssets | null;
};

type UserWithEquippedFrame = User & {
  equippedFrameItem?: Pick<ShopItem, 'imageUrl'> | null;
  equippedDiceItem?: Pick<ShopItem, 'imageUrl'> | null;
  equippedMapItem?: Pick<ShopItem, 'metadata'> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getEquippedMapAssets = (user: UserWithEquippedFrame): EquippedMapAssets | null => {
  const metadata = user.equippedMapItem?.metadata;
  if (!isRecord(metadata) || metadata.skinType !== 'MAP' || !isRecord(metadata.mapAssets)) {
    return null;
  }

  const mapAssets = metadata.mapAssets;
  if (
    typeof mapAssets.previewImageUrl !== 'string'
    || typeof mapAssets.addCardImageUrl !== 'string'
    || !isRecord(mapAssets.zodiacBoxImageUrls)
  ) {
    return null;
  }

  const zodiacBoxImageUrls = {} as Record<MapZodiacKey, string>;
  for (const key of MAP_ZODIAC_KEYS) {
    const imageUrl = mapAssets.zodiacBoxImageUrls[key];
    if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
      return null;
    }

    zodiacBoxImageUrls[key] = imageUrl;
  }

  return {
    previewImageUrl: mapAssets.previewImageUrl,
    addCardImageUrl: mapAssets.addCardImageUrl,
    zodiacBoxImageUrls
  };
};

export const toSafeUser = (user: UserWithEquippedFrame): SafeUser => ({
  id: user.id,
  username: user.username,
  avatar: user.avatar,
  elo: user.elo,
  coins: user.coins,
  gems: user.gems,
  role: user.role,
  equippedFrameItemId: user.equippedFrameItemId ?? null,
  equippedFrameImageUrl: user.equippedFrameItem?.imageUrl ?? null,
  equippedDiceItemId: user.equippedDiceItemId ?? null,
  equippedDicePanelImageUrl: user.equippedDiceItem?.imageUrl ?? null,
  equippedMapItemId: user.equippedMapItemId ?? null,
  equippedMapAssets: getEquippedMapAssets(user)
});
