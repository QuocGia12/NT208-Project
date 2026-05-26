import type { AuthUser } from '@/lib/types/auth';

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

export type ShopCardsResponse = {
  cards: ShopCard[];
};

export type BuyCardResponse = {
  message: string;
  user: AuthUser;
  purchase: {
    cardId: string;
    cardName: string;
    priceCoins: number;
    priceGems: number;
    ownedQuantity: number;
  };
};
