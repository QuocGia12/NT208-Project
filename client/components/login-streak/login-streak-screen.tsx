'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { claimLoginStreak, fetchLoginStreak } from '@/lib/api/login-streak';
import type { LoginStreakReward, LoginStreakStatus } from '@/lib/types/auth';
import { useAuthStore } from '@/store/auth-store';
import { FixedAspectScene } from '@/components/layout/fixed-aspect-scene';

type LoginStreakDayState = 'claimed' | 'available' | 'locked';

type LoginStreakDay = {
  day: number;
  imageSrc: string;
  reward: LoginStreakReward;
  state: LoginStreakDayState;
};

const FRAME_SIZE = {
  width: 1920,
  height: 1080
} as const;

const ASSETS = {
  background: '/game-ui/login-streak/background.png',
  returnMain: '/game-ui/create-match/RETURN-MainScreen.svg',
  rewardAudio: '/music/achievement.mp3'
} as const;

const FALLBACK_REWARDS: LoginStreakReward[] = [
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

const toSceneStyle = (left: number, top: number, width: number, height: number) => ({
  height: `${(height / FRAME_SIZE.height) * 100}%`,
  left: `${(left / FRAME_SIZE.width) * 100}%`,
  top: `${(top / FRAME_SIZE.height) * 100}%`,
  width: `${(width / FRAME_SIZE.width) * 100}%`
});

const formatRewardText = (reward: LoginStreakReward) =>
  `${reward.amount} ${reward.type === 'coin' ? 'coin' : 'gem'}`;

const buildDays = (streak: LoginStreakStatus | null): LoginStreakDay[] => {
  const rewards = streak?.rewards?.length === 12 ? streak.rewards : FALLBACK_REWARDS;
  const claimedDays = new Set(streak?.claimedDays ?? []);
  const highlightedDay = streak?.currentDay ?? 0;

  return Array.from({ length: 12 }, (_, index) => {
    const day = index + 1;
    const state: LoginStreakDayState = claimedDays.has(day)
      ? 'claimed'
      : day === highlightedDay
        ? 'available'
        : 'locked';

    return {
      day,
      imageSrc: `/game-ui/login-streak/day${day}.png`,
      reward: rewards[index],
      state
    };
  });
};

export const LoginStreakScreen = () => {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const storedStreak = useAuthStore((state) => state.loginStreak);
  const setLoginStreak = useAuthStore((state) => state.setLoginStreak);
  const updateUser = useAuthStore((state) => state.updateUser);
  const rewardAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isLoading, setIsLoading] = useState(!storedStreak);
  const [isClaiming, setIsClaiming] = useState(false);

  const days = useMemo(() => buildDays(storedStreak), [storedStreak]);

  useEffect(() => {
    const audio = new Audio(ASSETS.rewardAudio);
    audio.preload = 'auto';
    rewardAudioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      if (rewardAudioRef.current === audio) {
        rewardAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadStreak = async () => {
      setIsLoading(true);

      try {
        const streak = await fetchLoginStreak(token);
        if (cancelled) return;
        setLoginStreak(streak);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load login streak', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadStreak();

    return () => {
      cancelled = true;
    };
  }, [setLoginStreak, token]);

  const handleClaim = async (day: LoginStreakDay) => {
    if (!token || isLoading || isClaiming || day.state !== 'available') {
      return;
    }

    setIsClaiming(true);

    try {
      const result = await claimLoginStreak(token);
      setLoginStreak(result.streak);
      updateUser(result.user);
      const rewardAudio = rewardAudioRef.current;
      if (rewardAudio) {
        rewardAudio.currentTime = 0;
        void rewardAudio.play().catch((playError) => {
          console.error('Failed to play login streak reward audio', playError);
        });
      }
    } catch (error) {
      console.error('Failed to claim login streak reward', error);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#091321] text-[#fff4d6]">
      <FixedAspectScene>
        <div className="relative h-full w-full overflow-hidden bg-[#140f08]">
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            src={ASSETS.background}
          />

          <button
            className="absolute z-20 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => router.push('/lobby')}
            style={toSceneStyle(28, 17, 279, 134)}
            type="button"
          >
            <img
              alt="Trở về sảnh chính"
              className="h-full w-full object-contain"
              src={ASSETS.returnMain}
            />
          </button>

          <section
            aria-label="Login streak 12 day rewards"
            className="absolute z-10 grid grid-cols-4 grid-rows-3 content-center justify-items-center gap-x-[1.2%] gap-y-[3.6%]"
            style={toSceneStyle(300, 150, 1320, 780)}
          >
            {days.map((day) => (
              <button
                aria-label={`Day ${day.day} - ${formatRewardText(day.reward)}`}
                className={`login-streak-card ${day.state === 'available' ? 'login-streak-card-available' : ''}`}
                disabled={day.state !== 'available' || isLoading || isClaiming}
                key={day.day}
                onClick={() => void handleClaim(day)}
                type="button"
              >
                <img
                  alt={`Day ${day.day}`}
                  className="h-full w-full object-contain"
                  src={day.imageSrc}
                  style={{
                    filter:
                      day.state === 'claimed'
                        ? 'brightness(0.72) saturate(0.9)'
                        : 'brightness(1)',
                    transform: day.state === 'available' ? 'scale(1.03)' : 'scale(1)'
                  }}
                />
              </button>
            ))}
          </section>
        </div>
      </FixedAspectScene>
    </main>
  );
};
