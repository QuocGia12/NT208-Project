'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { FixedAspectScene } from '@/components/layout/fixed-aspect-scene';

type ChapterMeta = {
  id: number;
  bg: string;
  unlocked: boolean;
};

type ChapterContent = {
  title: string;
  text: string;
};

// Only metadata here — no large strings, bundle stays tiny
const CHAPTERS: ChapterMeta[] = [
  { id: 1, bg: '/images/stories/chapter-1-bg.png', unlocked: true  },
  { id: 2, bg: '/images/stories/chapter-2-bg.png', unlocked: true  },
  { id: 3, bg: '/images/stories/chapter-3-bg.png', unlocked: true  },
  { id: 4, bg: '/images/stories/chapter-4-bg.png', unlocked: true  },
  { id: 5, bg: '/images/stories/chapter-5-bg.png', unlocked: true  },
  { id: 6, bg: '/images/stories/chapter-6-bg.png', unlocked: true  },
  { id: 7, bg: '/images/stories/chapter-7-bg.png', unlocked: false },
  { id: 8, bg: '/images/stories/chapter-8-bg.png', unlocked: false },
  { id: 9, bg: '/images/stories/chapter-9-bg.png', unlocked: false },
];

const CHAPTERS_PER_PAGE = 6;
const TOTAL_PAGES = Math.ceil(CHAPTERS.length / CHAPTERS_PER_PAGE);

const LORA = 'var(--font-lora), "Lora", serif';

export default function StoriesPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(1);
  const [page, setPage] = useState(0);
  const [content, setContent] = useState<ChapterContent | null>(null);
  const [loading, setLoading] = useState(false);

  const current = CHAPTERS.find((c) => c.id === selectedId) ?? CHAPTERS[0];
  const visibleChapters = CHAPTERS.slice(page * CHAPTERS_PER_PAGE, (page + 1) * CHAPTERS_PER_PAGE);

  // Fetch chapter content from server whenever selection changes
  useEffect(() => {
    if (!current.unlocked) {
      setContent(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setContent(null);

    fetch(`/api/stories/${current.id}`)
      .then((r) => r.json())
      .then((data: ChapterContent) => {
        if (!cancelled) setContent(data);
      })
      .catch(() => {
        if (!cancelled) setContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [current.id, current.unlocked]);

  const handlePrev = () => {
    if (page === 0) return;
    const newPage = page - 1;
    setPage(newPage);
    setSelectedId(CHAPTERS[newPage * CHAPTERS_PER_PAGE].id);
  };

  const handleNext = () => {
    if (page >= TOTAL_PAGES - 1) return;
    const newPage = page + 1;
    setPage(newPage);
    setSelectedId(CHAPTERS[newPage * CHAPTERS_PER_PAGE].id);
  };

  return (
    <div className="game-viewport" style={{ background: '#0a0205' }}>
      <FixedAspectScene className="relative">
        <div className="relative size-full overflow-hidden">

          {/* Chapter background */}
          <img
            alt=""
            className="absolute inset-0 size-full object-cover pointer-events-none select-none"
            key={current.bg}
            src={current.bg}
          />

          {/* Gradient footer overlay — scaleY(-1) flips it correct */}
          <img
            alt=""
            className="absolute bottom-0 left-0 w-full pointer-events-none select-none"
            src="/images/stories/gradient-footer.png"
            style={{ height: '200px', objectFit: 'cover', transform: 'scaleY(-1)' }}
          />

          {/* Stories panel — unlocked chapters only */}
          {current.unlocked && (
            <div
              className="absolute left-0"
              style={{ bottom: '200px', width: '562px', height: '729px' }}
            >
              {/* Scroll/parchment background */}
              <div className="absolute left-0 top-0 overflow-hidden" style={{ width: '598px', height: '786px' }}>
                <img alt="" className="absolute inset-0 size-full object-cover" src="/images/stories/scroll-panel.png" />
              </div>

              {/* Content column — symmetric left/right so it centers on the scroll */}
              <div
                className="absolute flex flex-col items-center"
                style={{ top: '48px', left: '125px', right: '90px', bottom: '120px' }}
              >
                {/* Number_Chapter */}
                <p
                  className="flex-shrink-0 text-center w-full"
                  style={{ fontFamily: LORA, fontWeight: 700, color: '#FCDF92', fontSize: '32px', lineHeight: '1.25' }}
                >
                  Chương {current.id}
                </p>

                {/* Title_Chapter */}
                <p
                  className="flex-shrink-0 text-center w-full"
                  style={{ fontFamily: LORA, fontWeight: 700, color: '#4F2002', fontSize: '26px', lineHeight: '1.3', marginTop: '20px' }}
                >
                  {loading ? '…' : (content?.title ?? '')}
                </p>

                <div className="flex-shrink-0 w-4/5" style={{ borderTop: '1px solid #c9a06a', margin: '10px 0' }} />

                {/* Story text — scrollable */}
                <div className="flex-1 w-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {loading && (
                    <p style={{ fontFamily: LORA, color: '#4F2002', fontSize: '18px', opacity: 0.5 }}>
                      Đang tải...
                    </p>
                  )}
                  {!loading && content?.text?.split('\n\n').map((paragraph, i) => (
                    <p
                      key={i}
                      style={{
                        fontFamily: LORA,
                        fontWeight: 400,
                        color: '#4F2002',
                        fontSize: '18px',
                        lineHeight: '1.6',
                        textAlign: 'justify',
                        marginBottom: '0.6em',
                      }}
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* List_Chapter footer strip */}
          <div className="absolute bottom-0 left-0 flex items-center" style={{ width: '1920px', height: '200px' }}>
            {/* Back arrow */}
            <button
              aria-label="Trang trước"
              className="shrink-0 flex items-center justify-center transition-opacity hover:brightness-110 active:scale-95"
              disabled={page === 0}
              onClick={handlePrev}
              style={{ width: '150px', height: '200px', opacity: page === 0 ? 0.35 : 1 }}
              type="button"
            >
              <img alt="" src="/images/stories/arrow-back.png" style={{ width: '102px', height: '102px', display: 'block' }} />
            </button>

            {/* Chapter cards */}
            <div className="flex flex-1 items-center min-w-0" style={{ gap: '10px' }}>
              {visibleChapters.map((chapter) => {
                const isSelected = chapter.id === selectedId;
                return (
                  <button
                    key={chapter.id}
                    aria-label={`Chương ${chapter.id}`}
                    className="shrink-0 relative overflow-hidden transition-transform hover:brightness-110"
                    onClick={() => setSelectedId(chapter.id)}
                    style={{ width: '262px', height: '200px', transform: isSelected ? 'scale(1.05)' : 'scale(1)' }}
                    type="button"
                  >
                    <div
                      className="absolute overflow-hidden rounded-[12px]"
                      style={{
                        left: '11px', top: '10px', width: '240px', height: '135px',
                        border: `3px solid ${isSelected ? '#fcd65a' : '#946b39'}`,
                      }}
                    >
                      <img alt={`Chương ${chapter.id}`} className="absolute inset-0 size-full object-cover" src={chapter.bg} />
                      {!chapter.unlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <img alt="Bị khóa" src="/images/stories/lock-icon.png" style={{ width: '62px', height: '62px', display: 'block', objectFit: 'contain' }} />
                        </div>
                      )}
                    </div>
                    <div className="absolute left-0 right-0 overflow-hidden" style={{ top: '145px', height: '45px' }}>
                      <p className="text-center" style={{ fontFamily: LORA, fontWeight: 700, color: '#E3A860', fontSize: '28px', lineHeight: '45px' }}>
                        Chương {chapter.id}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Next arrow */}
            <button
              aria-label="Trang sau"
              className="shrink-0 flex items-center justify-center transition-opacity hover:brightness-110 active:scale-95"
              disabled={page >= TOTAL_PAGES - 1}
              onClick={handleNext}
              style={{ width: '150px', height: '200px', opacity: page >= TOTAL_PAGES - 1 ? 0.35 : 1 }}
              type="button"
            >
              <img alt="" src="/images/stories/arrow-next.png" style={{ width: '102px', height: '102px', display: 'block' }} />
            </button>
          </div>

          {/* Header */}
          <div className="absolute top-0 left-0 overflow-hidden flex items-center" style={{ width: '1920px', height: '151px' }}>
            <img alt="" className="absolute inset-0 size-full object-cover pointer-events-none" src="/images/stories/gradient-header.png" />
            <button
              className="relative z-10 ml-[28px] flex-shrink-0 transition-transform hover:scale-[1.03] active:scale-[0.97]"
              onClick={() => router.push('/')}
              style={{ width: '279px', height: '135px' }}
              type="button"
            >
              <img alt="Trang chủ" className="size-full object-contain" src="/images/stories/btn-return-main.png" />
            </button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img alt="CỐT TRUYỆN" src="/images/stories/header-title.png" style={{ height: '70px', objectFit: 'contain' }} />
            </div>
          </div>

        </div>
      </FixedAspectScene>
    </div>
  );
}
