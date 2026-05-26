'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { fetchLeaderboard } from '@/lib/api/users';
import type { LeaderboardEntry } from '@/lib/types/user';
import { useAuthStore } from '@/store/auth-store';

const topRankClass: Record<number, string> = {
  1: 'leaderboard-top-gold',
  2: 'leaderboard-top-silver',
  3: 'leaderboard-top-bronze'
};

const rankMedalLabel: Record<number, string> = {
  1: 'Gold Crown',
  2: 'Silver Crown',
  3: 'Bronze Crown'
};

const topBadgeByRank: Record<number, string> = {
  1: '/images/rank-badges/top1.png',
  2: '/images/rank-badges/top2.png',
  3: '/images/rank-badges/top3.png'
};

const Avatar = ({ user, large = false }: { user: LeaderboardEntry; large?: boolean }) => (
  <div
    className={`leaderboard-avatar ${large ? 'leaderboard-avatar-lg' : ''}`}
    style={user.avatar ? { backgroundImage: `url(${user.avatar})` } : undefined}
  >
    {!user.avatar ? (
      <span className="moba-heading text-cyan-100">
        {user.username.charAt(0).toUpperCase()}
      </span>
    ) : null}
  </div>
);

export default function LeaderboardPage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetchLeaderboard(token);
        setEntries(response.leaderboard);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load leaderboard.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [token]);

  const topThree = useMemo(() => entries.slice(0, 3), [entries]);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="panel-container panel-container-leaderboard">
        <img
          src="/images/ui-game/panel-bxh.png"
          className="panel-bg pointer-events-none"
          alt=""
        />

        <div className="panel-content space-y-4 px-[8%] py-[4%]">
          <header className="leaderboard-header-panel animate-fade-in-up">
            <p className="moba-heading text-xs uppercase tracking-[0.24em] text-cyan-300/90">
              Ranked Arena
            </p>
            <h1 className="moba-heading mt-1 text-2xl uppercase tracking-[0.12em] text-amber-100">
              Top 50 Commanders
            </h1>
            <p className="mt-2 text-sm text-slate-300/85">
              Climb the Elo ladder and earn your place among the elite zodiac warriors.
            </p>
          </header>

          {errorMessage ? (
            <div className="friends-alert friends-alert-error animate-fade-in">{errorMessage}</div>
          ) : null}

          {isLoading ? (
            <div className="empty-state">
              <p className="text-sm text-slate-300/90">Loading leaderboard...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <p className="text-sm text-slate-300/90">No leaderboard entries available yet.</p>
            </div>
          ) : (
            <>
              <section className="leaderboard-top-grid">
                {topThree.map((entry) => {
                  const topBadgeSrc = topBadgeByRank[entry.rank];

                  return (
                    <article
                      className={`leaderboard-top-card ${topRankClass[entry.rank] ?? ''} animate-fade-in-up`}
                      key={entry.id}
                      style={{ animationDelay: `${entry.rank * 80}ms` }}
                    >
                      <p className="moba-heading text-[0.68rem] uppercase tracking-[0.2em] text-slate-300">
                        {rankMedalLabel[entry.rank] ?? `Rank ${entry.rank}`}
                      </p>
                      <p className="moba-heading mt-1 text-3xl text-amber-100">#{entry.rank}</p>

                      <div className="mt-3 flex justify-center">
                        <Avatar large user={entry} />
                      </div>

                      {topBadgeSrc ? (
                        <div className="mt-3 flex items-center justify-center">
                          <Image
                            src={topBadgeSrc}
                            alt={`Top ${entry.rank} badge`}
                            width={80}
                            height={80}
                            className="leaderboard-top-rank-badge"
                          />
                        </div>
                      ) : null}

                      <p className="mt-3 truncate text-sm font-bold uppercase tracking-[0.1em] text-slate-100">
                        {entry.username}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
                        {entry.elo.toLocaleString()} Elo
                      </p>
                    </article>
                  );
                })}
              </section>

              <section
                className="leaderboard-table-panel animate-fade-in-up"
                style={{ animationDelay: '220ms' }}
              >
                <div className="leaderboard-table-head">
                  <span>Rank</span>
                  <span>Player</span>
                  <span className="text-right">Elo</span>
                </div>

                <div className="leaderboard-table-body">
                  {entries.map((entry) => {
                    const topBadgeSrc = topBadgeByRank[entry.rank];

                    return (
                      <article
                        className={`leaderboard-row ${topRankClass[entry.rank] ? 'leaderboard-row-top' : ''}`}
                        key={entry.id}
                      >
                        <span className="leaderboard-rank">#{entry.rank}</span>

                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar user={entry} />
                          {topBadgeSrc ? (
                            <Image
                              src={topBadgeSrc}
                              alt={`Top ${entry.rank} badge`}
                              width={28}
                              height={28}
                              className="leaderboard-row-rank-badge"
                            />
                          ) : null}
                          <Link
                            className="truncate text-sm font-semibold uppercase tracking-[0.08em] text-amber-100 hover:text-amber-200"
                            href={`/profile/${encodeURIComponent(entry.username)}`}
                          >
                            {entry.username}
                          </Link>
                        </div>

                        <span className="text-right text-sm font-bold text-cyan-200">
                          {entry.elo.toLocaleString()}
                        </span>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      <button
        className="panel-back-button"
        onClick={() => router.push('/lobby')}
        type="button"
      >
        <img src="/images/ui-game/btn-back.png" className="w-full" alt="Trở về" />
      </button>
    </div>
  );
}

