'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SettingsModal } from '@/components/app/settings-modal';
import { FixedAspectScene } from '@/components/layout/fixed-aspect-scene';
import {
  SETTINGS_STORAGE_KEY,
  SETTINGS_UPDATED_EVENT,
  WAITING_AUDIO_STATE_EVENT,
  type WaitingAudioStateDetail,
  getEffectiveMusicVolume,
  loadGameSettings
} from '@/lib/game-audio-settings';
import { getLevelFromElo } from '@/lib/rank-system';
import { useAuthStore } from '@/store/auth-store';

type AuthenticatedShellProps = {
  children: ReactNode;
};

const UI_GAME_ASSETS = {
  mainBg: '/images/ui-game/main-bg.png',
  mainBgMobile: '/images/ui-game/main-bg-mobile.jpg',
  coin: '/images/ui-game/icon-coin.png',
  diamond: '/images/ui-game/icon-diamond.png',
  settings: '/images/ui-game/btn-settings.png',
  avatarFrame: '/images/ui-game/frame-avt.png',
  btnStart: '/images/ui-game/btn_start.png',
  btnShop: '/images/ui-game/btn-shop.png',
  btnFriends: '/images/ui-game/btn-friends.png',
  btnInbox: '/images/ui-game/btn-inbox.png',
  btnBxh: '/images/ui-game/btn-bxh.png'
} as const;

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  {
    href: '/shop',
    label: 'SHOP',
    icon: UI_GAME_ASSETS.btnShop
  },
  {
    href: '/friends',
    label: 'FRIENDS',
    icon: UI_GAME_ASSETS.btnFriends
  },
  {
    href: '/leaderboard',
    label: 'BXH',
    icon: UI_GAME_ASSETS.btnBxh
  },
  {
    href: '/chat',
    label: 'INBOX',
    icon: UI_GAME_ASSETS.btnInbox
  }
];

const adminNavItem: NavItem = {
  href: '/admin/shop',
  label: 'ADMIN',
  icon: UI_GAME_ASSETS.btnShop
};

const toSceneStyle = (left: number, top: number, width: number, height: number) => ({
  height: `${(height / 1080) * 100}%`,
  left: `${(left / 1920) * 100}%`,
  top: `${(top / 1080) * 100}%`,
  width: `${(width / 1920) * 100}%`
});

export const AuthenticatedShell = ({ children }: AuthenticatedShellProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const isLobbyRoute = pathname === '/lobby' || pathname === '/';
  const isGameRoute = pathname.startsWith('/game/');
  const isMatchmakingRoute = pathname.startsWith('/matchmaking');

  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (isGameRoute) {
      return undefined;
    }

    const audio = new Audio('/music/music-loop.mp3');
    audio.loop = true;
    audio.preload = 'auto';

    const applyVolume = () => {
      const settings = loadGameSettings();
      const volume = getEffectiveMusicVolume(settings);
      audio.volume = volume;
      audio.muted = volume === 0;
    };

    const handleSettingsUpdated = () => {
      applyVolume();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_STORAGE_KEY) return;
      applyVolume();
    };

    const handleWaitingAudioState = (event: Event) => {
      const customEvent = event as CustomEvent<WaitingAudioStateDetail>;
      const isActive = customEvent.detail?.isActive;
      if (isActive) {
        audio.pause();
        return;
      }

      if (audio.muted || audio.volume <= 0) {
        return;
      }

      void audio.play().catch(() => {
        // Autoplay might be blocked until user interaction.
      });
    };

    applyVolume();
    void audio.play().catch(() => {
      // Autoplay might be blocked until user interaction.
    });

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
    window.addEventListener('storage', handleStorage);
    window.addEventListener(WAITING_AUDIO_STATE_EVENT, handleWaitingAudioState as EventListener);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(
        WAITING_AUDIO_STATE_EVENT,
        handleWaitingAudioState as EventListener
      );
      audio.pause();
      audio.src = '';
    };
  }, [isGameRoute]);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (hasHydrated && !token) {
      router.replace('/login');
    }
  }, [hasHydrated, token, router]);

  const profile = useMemo(
    () => ({
      username: user?.username ?? 'Guest',
      avatar: user?.avatar ?? null,
      elo: user?.elo ?? 1000,
      coins: user?.coins ?? 0,
      gems: user?.gems ?? 0
    }),
    [user]
  );

  const visibleNavItems = useMemo(
    () => (user?.role === 'ADMIN' ? [...navItems, adminNavItem] : navItems),
    [user?.role]
  );

  const level = getLevelFromElo(profile.elo);
  const avatarLetter = profile.username.charAt(0).toUpperCase();
  const displayName = profile.username.length > 10
    ? `${profile.username.slice(0, 10)}...`
    : profile.username;

  const handleSettingsClick = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleSettingsClose = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  if (!hasHydrated) {
    return (
      <main className="lobby-screen flex min-h-screen items-center justify-center px-6 text-center text-slate-300">
        Initializing lobby...
      </main>
    );
  }

  if (!token) {
    return (
      <main className="lobby-screen flex min-h-screen items-center justify-center px-6 text-center text-slate-300">
        Redirecting to login...
      </main>
    );
  }

  if (isGameRoute || isMatchmakingRoute) {
    return <>{children}</>;
  }

  if (isLobbyRoute) {
    return (
      <div className="game-viewport" style={{ background: '#091321' }}>
        <FixedAspectScene className="relative z-10" sceneClassName="pointer-events-none">
          <div className="relative h-full w-full">
            <picture className="absolute inset-0 h-full w-full pointer-events-none select-none">
              <source media="(min-width: 1280px)" srcSet={UI_GAME_ASSETS.mainBg} />
              <img alt="" className="h-full w-full object-cover" src={UI_GAME_ASSETS.mainBgMobile} />
            </picture>

            <div className="absolute inset-0 z-10 pointer-events-none">{children}</div>

            <button
              className="absolute z-20 pointer-events-auto transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => router.push('/matchmaking')}
              style={toSceneStyle(1390, 854, 500, 264)}
              type="button"
            >
              <img
                alt="Bắt đầu chơi"
                className="h-full w-full object-contain"
                src={UI_GAME_ASSETS.btnStart}
              />
            </button>

            <Link
              className="absolute z-20 block pointer-events-auto transition-transform hover:scale-[1.02]"
              href="/profile"
              style={toSceneStyle(22, 12, 662, 178)}
            >
              <img alt="" className="absolute inset-0 h-full w-full object-contain" src={UI_GAME_ASSETS.avatarFrame} />
              <div
                className="absolute left-[3.3%] top-[6.7%] flex w-[23%] aspect-square items-center justify-center overflow-hidden rounded-full bg-[#f7f2e2]"
                style={
                  profile.avatar
                    ? {
                        backgroundImage: `url(${profile.avatar})`,
                        backgroundPosition: 'center',
                        backgroundSize: 'cover'
                      }
                    : undefined
                }
              >
                {!profile.avatar ? (
                  <span
                    className="moba-heading text-[#7b4b1d]"
                    style={{ fontSize: 'clamp(1.2rem, 2.6vw, 3rem)' }}
                  >
                    {avatarLetter}
                  </span>
                ) : null}
              </div>

              <div className="absolute left-[30%] top-[34%] w-[54%] pr-[1%]">
                <p
                  className="overflow-hidden break-words tracking-[0.07em] [overflow-wrap:anywhere] [word-break:break-word] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                  style={{
                    fontFamily: "'FC Lilita One', cursive",
                    color: '#FCD65A',
                    fontSize: 'clamp(0.68rem, 1.45vw, 1.65rem)',
                    lineHeight: 1.02,
                    WebkitTextStroke: 'clamp(1px, 0.18vw, 3px) #4C1616',
                    paintOrder: 'stroke fill'
                  }}
                >
                  {displayName}
                </p>

                <div
                  className="mt-[5%] inline-block rounded-full bg-[rgba(76,22,22,0.85)]"
                  style={{ padding: 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.7vw, 12px)' }}
                >
                  <span
                    style={{
                      fontFamily: "'FC Lilita One', cursive",
                      color: '#FCD65A',
                      fontSize: 'clamp(0.45rem, 0.75vw, 0.875rem)'
                    }}
                  >
                    LEVEL {level}
                  </span>
                </div>
              </div>
            </Link>

            <div className="absolute z-20" style={toSceneStyle(1050, 60, 313, 106)}>
              <img alt="Coins" className="h-full w-full object-contain" src={UI_GAME_ASSETS.coin} />
              <span
                className="moba-heading absolute right-[17%] top-[28%] uppercase tracking-[0.08em] text-[#fff8dc] [text-shadow:0_3px_0_rgba(93,52,11,0.9)]"
                style={{ fontSize: 'clamp(0.65rem, 1.45vw, 1.875rem)' }}
              >
                {profile.coins}
              </span>
            </div>

            <div className="absolute z-20" style={toSceneStyle(1400, 60, 313, 106)}>
              <img alt="Diamonds" className="h-full w-full object-contain" src={UI_GAME_ASSETS.diamond} />
              <span
                className="moba-heading absolute right-[17%] top-[28%] uppercase tracking-[0.08em] text-[#fff8dc] [text-shadow:0_3px_0_rgba(93,52,11,0.9)]"
                style={{ fontSize: 'clamp(0.65rem, 1.45vw, 1.875rem)' }}
              >
                {profile.gems}
              </span>
            </div>

            <button
              aria-label="Settings"
              className="absolute z-20 pointer-events-auto transition-transform hover:scale-[1.04] active:scale-[0.98]"
              onClick={handleSettingsClick}
              style={toSceneStyle(1728, 40, 150, 150)}
              type="button"
            >
              <img alt="Settings icon" className="h-full w-full object-contain" src={UI_GAME_ASSETS.settings} />
            </button>

            <nav
              aria-label="Main navigation"
              className="absolute bottom-[1.7%] left-[2.4%] z-20 flex gap-[0.55%] pointer-events-none"
            >
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    aria-label={item.label}
                    className={`block pointer-events-auto transition-transform hover:scale-[1.03] ${isActive ? 'scale-[1.05] brightness-110' : ''}`}
                    href={item.href}
                    key={item.href}
                    style={{ width: '12%' }}
                  >
                    <img alt={item.label} className="h-full w-full object-contain" src={item.icon} />
                  </Link>
                );
              })}
            </nav>
          </div>
        </FixedAspectScene>

        <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
      </div>
    );
  }

  return (
    <div className="game-viewport" style={{ background: '#091321' }}>
      <FixedAspectScene className="relative z-10" sceneClassName="pointer-events-none">
        <div className="relative h-full w-full">
          <picture className="absolute inset-0 h-full w-full pointer-events-none select-none">
            <source media="(min-width: 1280px)" srcSet={UI_GAME_ASSETS.mainBg} />
            <img alt="" className="h-full w-full object-cover" src={UI_GAME_ASSETS.mainBgMobile} />
          </picture>

          <div className="absolute inset-0 z-30 pointer-events-none">
            <main className="h-full w-full pointer-events-auto">{children}</main>
          </div>

          <Link
            className="absolute z-20 block pointer-events-auto transition-transform hover:scale-[1.02]"
            href="/profile"
            style={toSceneStyle(22, 12, 662, 178)}
          >
            <img alt="" className="absolute inset-0 h-full w-full object-contain" src={UI_GAME_ASSETS.avatarFrame} />
            <div
              className="absolute left-[3.3%] top-[6.7%] flex w-[23%] aspect-square items-center justify-center overflow-hidden rounded-full bg-[#f7f2e2]"
              style={
                profile.avatar
                  ? {
                      backgroundImage: `url(${profile.avatar})`,
                      backgroundPosition: 'center',
                      backgroundSize: 'cover'
                    }
                  : undefined
              }
            >
              {!profile.avatar ? (
                <span
                  className="moba-heading text-[#7b4b1d]"
                  style={{ fontSize: 'clamp(1.2rem, 2.6vw, 3rem)' }}
                >
                  {avatarLetter}
                </span>
              ) : null}
            </div>

            <div className="absolute left-[30%] top-[34%] w-[54%] pr-[1%]">
              <p
                className="overflow-hidden break-words tracking-[0.07em] [overflow-wrap:anywhere] [word-break:break-word] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
                style={{
                  fontFamily: "'FC Lilita One', cursive",
                  color: '#FCD65A',
                  fontSize: 'clamp(0.68rem, 1.45vw, 1.65rem)',
                  lineHeight: 1.02,
                  WebkitTextStroke: 'clamp(1px, 0.18vw, 3px) #4C1616',
                  paintOrder: 'stroke fill'
                }}
              >
                {displayName}
              </p>

              <div
                className="mt-[5%] inline-block rounded-full bg-[rgba(76,22,22,0.85)]"
                style={{ padding: 'clamp(1px, 0.15vw, 2px) clamp(6px, 0.7vw, 12px)' }}
              >
                <span
                  style={{
                    fontFamily: "'FC Lilita One', cursive",
                    color: '#FCD65A',
                    fontSize: 'clamp(0.45rem, 0.75vw, 0.875rem)'
                  }}
                >
                  LEVEL {level}
                </span>
              </div>
            </div>
          </Link>

          <div className="absolute z-20" style={toSceneStyle(1050, 60, 313, 106)}>
            <img alt="Coins" className="h-full w-full object-contain" src={UI_GAME_ASSETS.coin} />
            <span
              className="moba-heading absolute right-[17%] top-[28%] uppercase tracking-[0.08em] text-[#fff8dc] [text-shadow:0_3px_0_rgba(93,52,11,0.9)]"
              style={{ fontSize: 'clamp(0.65rem, 1.45vw, 1.875rem)' }}
            >
              {profile.coins}
            </span>
          </div>

          <div className="absolute z-20" style={toSceneStyle(1400, 60, 313, 106)}>
            <img alt="Diamonds" className="h-full w-full object-contain" src={UI_GAME_ASSETS.diamond} />
            <span
              className="moba-heading absolute right-[17%] top-[28%] uppercase tracking-[0.08em] text-[#fff8dc] [text-shadow:0_3px_0_rgba(93,52,11,0.9)]"
              style={{ fontSize: 'clamp(0.65rem, 1.45vw, 1.875rem)' }}
            >
              {profile.gems}
            </span>
          </div>

          <button
            aria-label="Settings"
            className="absolute z-20 pointer-events-auto transition-transform hover:scale-[1.04] active:scale-[0.98]"
            onClick={handleSettingsClick}
            style={toSceneStyle(1728, 40, 150, 150)}
            type="button"
          >
            <img alt="Settings icon" className="h-full w-full object-contain" src={UI_GAME_ASSETS.settings} />
          </button>

          <nav
            aria-label="Main navigation"
            className="absolute bottom-[1.7%] left-[2.4%] z-20 flex gap-[0.55%] pointer-events-none"
          >
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  aria-label={item.label}
                  className={`block pointer-events-auto transition-transform hover:scale-[1.03] ${isActive ? 'scale-[1.05] brightness-110' : ''}`}
                  href={item.href}
                  key={item.href}
                  style={{ width: '12%' }}
                >
                  <img alt={item.label} className="h-full w-full object-contain" src={item.icon} />
                </Link>
              );
            })}
          </nav>
        </div>
      </FixedAspectScene>

      <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
    </div>
  );
};
