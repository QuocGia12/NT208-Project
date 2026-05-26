import Image from 'next/image';

type RankBadgeIconSize = 'sm' | 'md' | 'lg';

type RankBadgeIconProps = {
  level: number;
  size?: RankBadgeIconSize;
  className?: string;
  decorative?: boolean;
};

const clampBadgeLevel = (level: number) => {
  if (!Number.isFinite(level)) {
    return 1;
  }

  return Math.max(1, Math.min(9, Math.round(level)));
};

const badgeSizePx: Record<RankBadgeIconSize, number> = {
  sm: 32,
  md: 36,
  lg: 40
};

export function RankBadgeIcon({
  level,
  size = 'md',
  className,
  decorative = true
}: RankBadgeIconProps) {
  const safeLevel = clampBadgeLevel(level);
  const src = `/images/rank-badges/level-${safeLevel.toString().padStart(2, '0')}.png`;
  const ariaLabel = `Level ${safeLevel} badge`;
  const sizePx = badgeSizePx[size];

  return (
    <span
      aria-hidden={decorative}
      className={`rank-badge-icon rank-badge-icon-${size}${className ? ` ${className}` : ''}`}
      role={decorative ? undefined : 'img'}
      style={{ height: `${sizePx}px`, width: `${sizePx}px` }}
      title={ariaLabel}
    >
      <Image
        alt={decorative ? '' : ariaLabel}
        className="rank-badge-icon-image"
        height={256}
        src={src}
        width={256}
      />
    </span>
  );
}
