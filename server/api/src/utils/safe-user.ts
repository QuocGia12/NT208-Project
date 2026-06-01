import { ShopItem, User, UserRole } from '@prisma/client';

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
};

type UserWithEquippedFrame = User & {
  equippedFrameItem?: Pick<ShopItem, 'imageUrl'> | null;
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
  equippedFrameImageUrl: user.equippedFrameItem?.imageUrl ?? null
});
