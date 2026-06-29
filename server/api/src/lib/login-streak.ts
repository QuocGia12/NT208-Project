import { Prisma, User } from '@prisma/client';

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOGIN_STREAK_CYCLE_LENGTH = 12;

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

export const LOGIN_STREAK_REWARDS: LoginStreakReward[] = [
  { type: 'coin', amount: 10 },
  { type: 'coin', amount: 15 },
  { type: 'coin', amount: 20 },
  { type: 'coin', amount: 25 },
  { type: 'coin', amount: 30 },
  { type: 'gem', amount: 10 },
  { type: 'coin', amount: 35 },
  { type: 'coin', amount: 40 },
  { type: 'coin', amount: 45 },
  { type: 'coin', amount: 50 },
  { type: 'coin', amount: 55 },
  { type: 'gem', amount: 20 }
];

const toVietnamDayNumber = (date: Date) =>
  Math.floor((date.getTime() + VIETNAM_OFFSET_MS) / DAY_MS);

const formatDayKey = (dayNumber: number) => {
  const shiftedDate = new Date(dayNumber * DAY_MS);
  const year = shiftedDate.getUTCFullYear();
  const month = String(shiftedDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shiftedDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayInfo = (date = new Date()) => {
  const todayDayNumber = toVietnamDayNumber(date);
  return {
    previousDayNumber: todayDayNumber - 1,
    todayDayNumber,
    todayKey: formatDayKey(todayDayNumber)
  };
};

const parseDayKey = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
};

const normalizeStreakDay = (day: number) => {
  if (!Number.isInteger(day) || day < 1 || day > LOGIN_STREAK_CYCLE_LENGTH) {
    return 0;
  }

  return day;
};

const getRewardForDay = (day: number) =>
  day >= 1 && day <= LOGIN_STREAK_CYCLE_LENGTH ? LOGIN_STREAK_REWARDS[day - 1] : null;

const getNextClaimDay = (
  lastClaimedDay: number,
  lastClaimDayNumber: number | null,
  previousDayNumber: number,
  claimedToday: boolean
) => {
  if (claimedToday && lastClaimedDay > 0) {
    return lastClaimedDay;
  }

  if (lastClaimDayNumber === previousDayNumber && lastClaimedDay > 0) {
    return lastClaimedDay >= LOGIN_STREAK_CYCLE_LENGTH ? 1 : lastClaimedDay + 1;
  }

  return 1;
};

export const buildLoginStreakStatus = (
  user: Pick<User, 'lastLoginStreakDate' | 'loginStreakDay'>
): LoginStreakStatus => {
  const { previousDayNumber, todayKey } = getTodayInfo();
  const lastClaimedDay = normalizeStreakDay(user.loginStreakDay);
  const lastClaimDayNumber = parseDayKey(user.lastLoginStreakDate);
  const claimedToday = lastClaimedDay > 0 && user.lastLoginStreakDate === todayKey;
  const currentDay = getNextClaimDay(
    lastClaimedDay,
    lastClaimDayNumber,
    previousDayNumber,
    claimedToday
  );
  const claimedDays = claimedToday
    ? Array.from({ length: currentDay }, (_, index) => index + 1)
    : currentDay <= 1
      ? []
      : Array.from({ length: currentDay - 1 }, (_, index) => index + 1);

  return {
    claimedDays,
    claimedToday,
    currentDay,
    justClaimedToday: false,
    lastClaimDate: user.lastLoginStreakDate ?? null,
    rewards: LOGIN_STREAK_REWARDS,
    todayReward: getRewardForDay(currentDay)
  };
};

export const claimLoginStreakReward = async (
  tx: Prisma.TransactionClient,
  userId: string
) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    include: {
      equippedFrameItem: {
        select: {
          imageUrl: true
        }
      },
      equippedDiceItem: {
        select: {
          imageUrl: true
        }
      },
      equippedMapItem: {
        select: {
          metadata: true
        }
      }
    }
  });

  if (!user) {
    throw new Error('User not found.');
  }

  const { todayKey } = getTodayInfo();
  const currentStatus = buildLoginStreakStatus(user);
  if (currentStatus.claimedToday) {
    throw new Error('Login streak already claimed today.');
  }

  const claimDay = currentStatus.currentDay > 0 ? currentStatus.currentDay : 1;
  const reward = LOGIN_STREAK_REWARDS[claimDay - 1];
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: {
      coins: reward.type === 'coin' ? { increment: reward.amount } : undefined,
      gems: reward.type === 'gem' ? { increment: reward.amount } : undefined,
      lastLoginStreakDate: todayKey,
      loginStreakDay: claimDay
    },
    include: {
      equippedFrameItem: {
        select: {
          imageUrl: true
        }
      },
      equippedDiceItem: {
        select: {
          imageUrl: true
        }
      },
      equippedMapItem: {
        select: {
          metadata: true
        }
      }
    }
  });

  return {
    streak: {
      ...buildLoginStreakStatus(updatedUser),
      justClaimedToday: true
    },
    user: updatedUser
  };
};
