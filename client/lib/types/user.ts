export type UserStats = {
  totalMatches: number;
  wins: number;
  winRate: number;
};

export type InventoryItem = {
  id: string;
  cardCode: string;
  cardName: string;
  cardDescription: string | null;
  cardImageUrl: string | null;
  cardRarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  quantity: number;
};

export type UserProfile = {
  id: string;
  username: string;
  avatar: string | null;
  elo: number;
  coins: number;
  gems: number;
  createdAt: string;
  stats: UserStats;
};

export type MyProfileResponse = {
  profile: UserProfile;
  inventory: InventoryItem[];
};

export type PublicProfileResponse = {
  profile: UserProfile;
};

export type LeaderboardEntry = {
  rank: number;
  id: string;
  username: string;
  avatar: string | null;
  elo: number;
};

export type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[];
};
