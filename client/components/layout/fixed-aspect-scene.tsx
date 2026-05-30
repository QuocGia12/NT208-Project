'use client';

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

type FixedAspectSceneProps = {
  children: ReactNode;
  className?: string;
  designHeight?: number;
  designWidth?: number;
  sceneClassName?: string;
};

const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export const FixedAspectScene = ({
  children,
  className,
  designHeight = 1080,
  designWidth = 1920,
  sceneClassName
}: FixedAspectSceneProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState({
    left: 0,
    scale: 1,
    top: 0
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const updateLayout = () => {
      const rect = host.getBoundingClientRect();
      const nextScale = Math.min(rect.width / designWidth, rect.height / designHeight);
      const sceneWidth = designWidth * nextScale;
      const sceneHeight = designHeight * nextScale;

      setLayout({
        left: Math.max(0, (rect.width - sceneWidth) / 2),
        scale: Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1,
        top: Math.max(0, (rect.height - sceneHeight) / 2)
      });
    };

    updateLayout();

    const observer = new ResizeObserver(() => {
      updateLayout();
    });

    observer.observe(host);
    window.addEventListener('orientationchange', updateLayout);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', updateLayout);
    };
  }, [designHeight, designWidth]);

  const sceneStyle = {
    height: `${designHeight}px`,
    left: `${layout.left}px`,
    top: `${layout.top}px`,
    transform: `scale(${layout.scale})`,
    transformOrigin: 'top left',
    width: `${designWidth}px`
  } satisfies CSSProperties;

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)} ref={hostRef}>
      <div className={cn('absolute', sceneClassName)} style={sceneStyle}>
        {children}
      </div>
    </div>
  );
};
