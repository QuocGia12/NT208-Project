'use client';

import { useEffect, useRef, useState } from 'react';

import { getLevelFromElo } from '@/lib/rank-system';
import { useAuthStore } from '@/store/auth-store';

const TOTAL_STORY_CHAPTERS = 9;
const LEVEL_STORAGE_KEY = 'zodiac_last_level';

// Add general lobby announcements here for the scrolling ticker.
// These show in rotation even when no events occur.
const GENERAL_ANNOUNCEMENTS: string[] = [
  // Example: 'Sự kiện Tết Giáp Thìn đang diễn ra! Vào nhận quà ngay.',
  // Example: 'Cập nhật mới: Thêm 3 khung avatar mới trong cửa hàng!',
];

type Toast = {
  id: string;
  message: string;
};

export function LobbyTicker() {
  const userElo = useAuthStore((s) => s.user?.elo ?? 1000);
  const [queue, setQueue] = useState<Toast[]>([]);
  const [current, setCurrent] = useState<Toast | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect level-up on ELO change, queue story-unlock toasts
  useEffect(() => {
    const currentLevel = getLevelFromElo(userElo);
    const stored = localStorage.getItem(LEVEL_STORAGE_KEY);

    if (stored === null) {
      localStorage.setItem(LEVEL_STORAGE_KEY, String(currentLevel));
      return;
    }

    const storedLevel = parseInt(stored, 10);
    if (currentLevel <= storedLevel) return;

    const toasts: Toast[] = [];

    for (let chap = storedLevel + 1; chap <= Math.min(currentLevel, TOTAL_STORY_CHAPTERS); chap++) {
      toasts.push({
        id: `story-unlock-${chap}`,
        message: `📖 Cốt truyện Chương ${chap} đã được mở khóa! Vào Cốt Truyện để đọc ngay.`,
      });
    }

    localStorage.setItem(LEVEL_STORAGE_KEY, String(currentLevel));
    if (toasts.length > 0) setQueue((q) => [...q, ...toasts]);
  }, [userElo]);

  // Process queue — show one toast at a time
  useEffect(() => {
    if (current !== null || queue.length === 0) return;

    const next = queue[0];
    setQueue((q) => q.slice(1));
    setCurrent(next);
    setVisible(true);

    dismissTimer.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setCurrent(null), 400); // wait for fade-out
    }, 5000);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [current, queue]);

  if (!current) return null;

  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        transition: 'opacity 0.4s ease',
        opacity: visible ? 1 : 0,
        maxWidth: '40%',
      }}
    >
      <div
        style={{
          background: 'rgba(10, 5, 2, 0.82)',
          border: '2px solid #c9903a',
          borderRadius: '12px',
          padding: '12px 24px',
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-baloo-2), cursive',
            color: '#fcd65a',
            fontSize: 'clamp(0.7rem, 1.4vw, 1.1rem)',
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {current.message}
        </p>
      </div>
    </div>
  );
}

// Static announcements ticker — shows when GENERAL_ANNOUNCEMENTS is non-empty
export function LobbyAnnouncementBar() {
  if (GENERAL_ANNOUNCEMENTS.length === 0) return null;

  const text = GENERAL_ANNOUNCEMENTS.join('   ·   ');

  return (
    <div
      className="absolute z-40 pointer-events-none overflow-hidden"
      style={{ bottom: '13%', left: 0, right: 0, height: '36px' }}
    >
      <div
        style={{
          background: 'rgba(10, 5, 2, 0.7)',
          borderTop: '1px solid #c9903a',
          borderBottom: '1px solid #c9903a',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <p
          className="whitespace-nowrap"
          style={{
            fontFamily: 'var(--font-baloo-2), cursive',
            color: '#fcd65a',
            fontSize: 'clamp(0.6rem, 1.1vw, 0.9rem)',
            animation: 'ticker-scroll 30s linear infinite',
            paddingLeft: '100%',
            margin: 0,
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
