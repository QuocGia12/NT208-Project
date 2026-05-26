export type RankTier = {
  minElo: number;
  label: string;
  css: string;
};

export const rankTiers: RankTier[] = [
  { minElo: 2400, label: 'Mythic', css: 'rank-mythic' },
  { minElo: 2000, label: 'Diamond', css: 'rank-diamond' },
  { minElo: 1600, label: 'Platinum', css: 'rank-platinum' },
  { minElo: 1300, label: 'Gold', css: 'rank-gold' },
  { minElo: 1100, label: 'Silver', css: 'rank-silver' },
  { minElo: 0, label: 'Beginner', css: 'rank-beginner' }
];

export const getRankTier = (elo: number) =>
  rankTiers.find((rank) => elo >= rank.minElo) ?? rankTiers[rankTiers.length - 1];

export const getRankLabel = (elo: number) => getRankTier(elo).label;

export const getBadgeLevelFromElo = (elo: number) => {
  const rawLevel = Math.floor((elo - 1000) / 180) + 1;
  return Math.max(1, Math.min(9, rawLevel));
};

export const getLevelFromElo = getBadgeLevelFromElo;
