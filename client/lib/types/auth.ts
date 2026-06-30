export type UserRole = 'USER' | 'ADMIN';

export type LoginStreakReward = {
  type: 'coin' | 'gem';
  amount: number;
};

export type LoginStreakStatus = {
  claimedDays: number[];
  claimedToday: boolean;
  currentDay: number;
  justClaimedToday: boolean;
  lastClaimDate: string | null;
  rewards: LoginStreakReward[];
  todayReward: LoginStreakReward | null;
};

export type EquippedMapAssets = {
  previewImageUrl: string;
  addCardImageUrl: string;
  zodiacBoxImageUrls: {
    ty: string;
    suu: string;
    dan: string;
    mao: string;
    thin: string;
    ti: string;
    ngo: string;
    mui: string;
    than: string;
    dau: string;
    tuat: string;
    hoi: string;
  };
};

export type AuthUser = {
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

export type RegisterPayload = {
  username: string;
  password: string;
  avatar?: string;
};

export type RegisterResponse = {
  user: AuthUser;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  streak: LoginStreakStatus;
  token: string;
  user: AuthUser;
};
