'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { fetchUserProfile } from '@/lib/api/users';
import { getLevelFromElo } from '@/lib/rank-system';
import type { UserProfile } from '@/lib/types/user';
import { useAuthStore } from '@/store/auth-store';

const SwordIcon = () => (
  <svg className="h-5 w-5 text-amber-300/80" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.5 3L21 9.5L9.5 21L3 14.5L14.5 3Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M14.5 3L17 5.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <path d="M3 14.5L5.5 17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
  </svg>
);

const TrophyIcon = () => (
  <svg className="h-5 w-5 text-amber-300/80" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 21H16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <path d="M12 17V21" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    <path d="M7 4H17V10C17 13 14.8 15 12 15C9.2 15 7 13 7 10V4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M7 7H4C4 9.5 5 11 7 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M17 7H20C20 9.5 19 11 17 11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const ChartIcon = () => (
  <svg className="h-5 w-5 text-cyan-300/80" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 20L9 14L13 18L21 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M17 10H21V14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="h-5 w-5 text-cyan-300/80" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3L4 7V12C4 16.4 7.4 20.4 12 21C16.6 20.4 20 16.4 20 12V7L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    <path d="M9 12L11 14L15 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
  </svg>
);

const EyeIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 12C4 7.6 7.6 5 12 5C16.4 5 20 7.6 22 12C20 16.4 16.4 19 12 19C7.6 19 4 16.4 2 12Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

function StatCard({
  icon,
  label,
  value,
  delay
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  delay: number;
}) {
  return (
    <div
      className="profile-stat-card animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-10 flex items-center gap-2.5">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {label}
        </span>
      </div>
      <p className="profile-stat-value relative z-10 mt-2">{value}</p>
    </div>
  );
}

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = typeof params.username === 'string' ? params.username : '';
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = currentUser?.username === username.toLowerCase();

  useEffect(() => {
    if (!token || !username) return;

    const load = async () => {
      try {
        const data = await fetchUserProfile(token, username);
        setProfile(data.profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [token, username]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="profile-hero p-6 sm:p-8">
          <div className="relative z-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div className="profile-avatar-ring h-24 w-24 animate-pulse bg-slate-800/60 sm:h-28 sm:w-28" />
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="mx-auto h-6 w-40 animate-pulse rounded-lg bg-slate-700/50 sm:mx-0" />
              <div className="mx-auto h-4 w-28 animate-pulse rounded-lg bg-slate-700/30 sm:mx-0" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="empty-state">
        <p className="text-sm text-rose-300">{error ?? 'Player not found.'}</p>
        <Link className="moba-secondary-button mt-4 inline-block" href="/lobby">
          Back to Lobby
        </Link>
      </div>
    );
  }

  if (isOwnProfile) {
    return (
      <div className="empty-state">
        <p className="text-sm text-slate-300">
          This is your own profile.{' '}
          <Link className="font-semibold text-cyan-300 hover:text-cyan-200" href="/profile">
            View your full profile →
          </Link>
        </p>
      </div>
    );
  }

  const level = getLevelFromElo(profile.elo);
  const avatarLetter = profile.username.charAt(0).toUpperCase();
  const joinDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/lobby');
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <button className="moba-secondary-button" onClick={handleBack} type="button">
          Back
        </button>
      </div>
      {/* ── Viewing indicator ── */}
      <div className="animate-fade-in flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-950/30 px-4 py-2.5 text-xs text-cyan-200/90">
        <EyeIcon />
        <span>
          Viewing <span className="font-bold uppercase tracking-wider">{profile.username}</span>&apos;s
          public profile
        </span>
      </div>

      {/* ── Hero Card ── */}
      <div className="profile-hero animate-fade-in-up p-6 sm:p-8">
        <div className="relative z-10 flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
          <div
            className="profile-avatar-ring h-24 w-24 bg-slate-900/90 bg-cover bg-center sm:h-28 sm:w-28"
            style={profile.avatar ? { backgroundImage: `url(${profile.avatar})` } : undefined}
          >
            {!profile.avatar && (
              <span className="moba-heading text-2xl text-cyan-100 sm:text-3xl">
                {avatarLetter}
              </span>
            )}
          </div>

          <div className="flex-1 space-y-2 text-center sm:text-left">
            <h1 className="moba-heading text-xl uppercase tracking-[0.14em] text-amber-100 sm:text-2xl">
              {profile.username}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rank-level-chip">Level {level}</span>
              <span className="text-[0.65rem] text-slate-500">•</span>
              <span className="text-[0.7rem] text-slate-400">Joined {joinDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          delay={80}
          icon={<SwordIcon />}
          label="Matches"
          value={profile.stats.totalMatches}
        />
        <StatCard
          delay={140}
          icon={<TrophyIcon />}
          label="Wins"
          value={profile.stats.wins}
        />
        <StatCard
          delay={200}
          icon={<ChartIcon />}
          label="Win Rate"
          value={`${profile.stats.winRate}%`}
        />
        <StatCard
          delay={260}
          icon={<ShieldIcon />}
          label="Elo"
          value={profile.elo}
        />
      </div>

      {/* ── Win Rate Bar ── */}
      <div className="animate-fade-in-up" style={{ animationDelay: '320ms' }}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-[0.12em] text-cyan-100/75">
            Win Rate
          </span>
          <span className="font-bold text-cyan-100">{profile.stats.winRate}%</span>
        </div>
        <div className="winrate-bar-track mt-2">
          <div
            className="winrate-bar-fill"
            style={{ width: `${Math.min(profile.stats.winRate, 100)}%` }}
          />
        </div>
      </div>

      {/* ── Inventory hidden notice ── */}
      <div className="empty-state animate-fade-in-up" style={{ animationDelay: '380ms' }}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/75">
          🔒 Inventory is private
        </p>
        <p className="mt-2 text-sm text-cyan-100/80">
          This player&apos;s card collection is not visible to other users.
        </p>
      </div>
    </div>
  );
}
