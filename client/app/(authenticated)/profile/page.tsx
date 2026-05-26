'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { fetchMyProfile } from '@/lib/api/users';
import { getLevelFromElo } from '@/lib/rank-system';
import type { InventoryItem, UserProfile } from '@/lib/types/user';
import { useAuthStore } from '@/store/auth-store';

const rarityOrder = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 } as const;
const rarityClass = {
  COMMON: 'inventory-card-common',
  RARE: 'inventory-card-rare',
  EPIC: 'inventory-card-epic',
  LEGENDARY: 'inventory-card-legendary'
} as const;
const rarityBadge = {
  COMMON: 'rarity-common',
  RARE: 'rarity-rare',
  EPIC: 'rarity-epic',
  LEGENDARY: 'rarity-legendary'
} as const;

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

const CardStackIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 5V3H19C20.1 3 21 3.9 21 5V17H19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
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

function InventoryCard({ item, index }: { item: InventoryItem; index: number }) {
  return (
    <div
      className={`inventory-card ${rarityClass[item.cardRarity]} animate-fade-in-up`}
      style={{ animationDelay: `${200 + index * 60}ms` }}
    >
  <div className="flex aspect-square items-center justify-center bg-gradient-to-b from-cyan-900/35 to-slate-950/70 p-3">
        {item.cardImageUrl ? (
          <img
            alt={item.cardName}
            className="h-full w-full rounded-lg object-cover"
            src={item.cardImageUrl}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg bg-cyan-950/40 p-2">
            <CardStackIcon />
            <span className="text-center text-[0.6rem] font-bold uppercase tracking-wider text-cyan-100/70">
              {item.cardCode}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-1.5 px-3 pb-3 pt-2">
        <div className="flex items-start justify-between gap-1">
          <p className="truncate text-xs font-bold text-cyan-50">{item.cardName}</p>
          {item.quantity > 1 && (
            <span className="shrink-0 rounded-md border border-cyan-300/30 bg-cyan-900/45 px-1.5 py-0.5 text-[0.6rem] font-bold text-cyan-100">
              x{item.quantity}
            </span>
          )}
        </div>
        <span className={`rarity-badge ${rarityBadge[item.cardRarity]}`}>
          {item.cardRarity}
        </span>
        {item.cardDescription && (
          <p className="line-clamp-2 text-[0.65rem] leading-relaxed text-cyan-100/70">
            {item.cardDescription}
          </p>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="profile-stat-card">
            <div className="h-4 w-16 animate-pulse rounded bg-slate-700/50" />
            <div className="mt-3 h-8 w-12 animate-pulse rounded bg-slate-700/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const data = await fetchMyProfile(token);
        setProfile(data.profile);
        setInventory(
          [...data.inventory].sort(
            (a, b) => rarityOrder[b.cardRarity] - rarityOrder[a.cardRarity]
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [token]);

  if (isLoading) return <LoadingSkeleton />;

  if (error || !profile) {
    return (
      <div className="empty-state">
        <p className="text-sm text-rose-300">{error ?? 'Could not load profile.'}</p>
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
      {/* ── Hero Card ── */}
      <div className="animate-fade-in">
        <button className="moba-secondary-button" onClick={handleBack} type="button">
          Back
        </button>
      </div>

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
            <div className="mt-1 flex items-center justify-center gap-3 sm:justify-start">
              <span className="text-xs font-bold text-amber-200">
                {profile.coins.toLocaleString()} Coins
              </span>
              <span className="text-[0.65rem] text-slate-500">•</span>
              <span className="text-xs font-bold text-cyan-200">
                {profile.gems.toLocaleString()} Gems
              </span>
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

      {/* ── Inventory Section ── */}
      <div className="animate-fade-in-up space-y-4" style={{ animationDelay: '380ms' }}>
        <h2 className="profile-section-heading">
          <CardStackIcon />
          Inventory ({inventory.length})
        </h2>

        {inventory.length === 0 ? (
          <div className="empty-state">
            <CardStackIcon />
            <p className="mt-3 text-sm text-cyan-100/80">
              Your inventory is empty. Collect cards by playing matches or visiting the Shop.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {inventory.map((item, i) => (
              <InventoryCard index={i} item={item} key={item.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
