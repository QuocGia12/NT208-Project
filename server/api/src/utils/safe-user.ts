import { User } from '@prisma/client';

export type SafeUser = {
  id: string;
  username: string;
  avatar: string | null;
  elo: number;
  coins: number;
  gems: number;
};

export const toSafeUser = (user: User): SafeUser => ({
  id: user.id,
  username: user.username,
  avatar: user.avatar,
  elo: user.elo,
  coins: user.coins,
  gems: user.gems
});
