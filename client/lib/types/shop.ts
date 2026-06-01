import type { AuthUser } from '@/lib/types/auth';

export type ShopItemType = 'SKIN' | 'ITEM';
export type SkinType = 'FRAME';

export type ShopItem = {
  id: string;
  type: ShopItemType;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCoins: number;
  priceGems: number;
  isActive: boolean;
  metadata: unknown;
  ownedQuantity: number;
  isApplied?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminShopItem = Omit<ShopItem, 'ownedQuantity'> & {
  createdAt: string;
  updatedAt: string;
};

export type ShopCard = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  priceCoins: number;
  priceGems: number;
  ownedQuantity: number;
};

export type ShopItemsResponse = {
  items: ShopItem[];
};

export type ShopCardsResponse = {
  cards: ShopCard[];
};

export type BuyShopItemResponse = {
  message: string;
  user: AuthUser;
  purchase: {
    itemId: string;
    itemName: string;
    itemType: ShopItemType;
    cardId?: string;
    cardName?: string;
    priceCoins: number;
    priceGems: number;
    ownedQuantity: number;
  };
};

export type BuyCardResponse = BuyShopItemResponse & {
  purchase: BuyShopItemResponse['purchase'] & {
    cardId: string;
    cardName: string;
  };
};

export type AdminShopItemsResponse = {
  items: AdminShopItem[];
};

export type UpsertAdminShopItemPayload = {
  type: ShopItemType;
  skinType?: SkinType;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  priceCoins: number;
  priceGems: number;
  isActive: boolean;
  metadata?: unknown;
};

export type AdminShopItemResponse = {
  item: AdminShopItem;
};

export type ApplyShopItemResponse = {
  message: string;
  user: AuthUser;
  item: AdminShopItem;
};

export type AdminShopUploadResponse = {
  imageUrl: string;
};
