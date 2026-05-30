import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';

type FigmaAuthSceneProps = {
  frameSrc: string;
  frameAlt: string;
  frameWidth: number;
  frameHeight: number;
  frameTop: number;
  logMessage?: string | null;
  children: ReactNode;
};

type AuthPanelProps = {
  children: ReactNode;
  className?: string;
};

type AuthInputProps = {
  assetSrc: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
  className?: string;
};

type AuthImageButtonProps = {
  src: string;
  alt: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export const FigmaAuthScene = ({
  frameSrc,
  frameAlt,
  frameWidth,
  frameHeight,
  frameTop,
  logMessage,
  children
}: FigmaAuthSceneProps) => {
  const sceneStyle = {
    width: 'min(100vw, calc(100dvh * 16 / 9))',
    aspectRatio: '1920 / 1080'
  } satisfies CSSProperties;

  const frameStyle = {
    width: `${(frameWidth / 1920) * 100}%`,
    aspectRatio: `${frameWidth} / ${frameHeight}`
  } satisfies CSSProperties;

  return (
    <main className="flex h-[100dvh] items-center justify-center overflow-hidden bg-[#180f05] text-[#fff2c8]">
      <div className="relative overflow-hidden" style={sceneStyle}>
        <Image
          alt=""
          className="object-cover object-center"
          fill
          priority
          sizes="100vw"
          src="/game-ui/sign-up-and-login/Background_SignUpSignIn.svg"
        />

        <div className="absolute left-1/2 top-[0.6%] z-30 w-[27.24%] -translate-x-1/2">
          <div className="relative aspect-[523/197]">
            <Image
              alt="Cuoc dua 12 con giap"
              className="object-contain"
              fill
              priority
              sizes="28vw"
              src="/game-ui/sign-up-and-login/Header.svg"
            />
          </div>
        </div>

        <div
          className="absolute left-1/2 z-10 -translate-x-1/2"
          style={{
            ...frameStyle,
            top: `${(frameTop / 1080) * 100}%`
          }}
        >
          <div className="relative h-full w-full">
            <Image alt={frameAlt} className="object-contain" fill priority sizes="40vw" src={frameSrc} />
            {children}
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-[1.2%] left-1/2 z-20 w-[56.04%] -translate-x-1/2">
          <div className="relative aspect-[1076/87]">
            <Image alt="" className="object-contain" fill sizes="56vw" src="/game-ui/sign-up-and-login/Log.svg" />
            <p
              className="absolute inset-x-[8%] inset-y-0 flex items-center justify-center text-center text-[clamp(1rem,1.7vw,2rem)] font-extrabold tracking-[0.02em] text-[#e07b3d]"
              style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700 }}
            >
              {logMessage?.trim() || 'Log'}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export const AuthPanel = ({ children, className }: AuthPanelProps) => (
  <div className={cn('absolute inset-0', className)}>{children}</div>
);

export const AuthInput = ({ assetSrc, inputProps, className }: AuthInputProps) => (
  <div className={cn('relative w-full', className)}>
    <div className="relative aspect-[409/78]">
      <Image alt="" className="object-contain" fill sizes="(max-width: 768px) 78vw, 409px" src={assetSrc} />
      <input
        {...inputProps}
        className={cn(
          'absolute inset-y-[16%] left-[18%] right-[7%] bg-transparent text-[clamp(0.92rem,1.15vw,1.4rem)] font-extrabold text-[#fce6ba] outline-none placeholder:text-[#f3d19a]/90',
          inputProps.className
        )}
        style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700 }}
      />
    </div>
  </div>
);

export const AuthImageButton = ({
  src,
  alt,
  type = 'button',
  disabled,
  onClick,
  className
}: AuthImageButtonProps) => (
  <button
    className={cn(
      'relative block transition duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100',
      className
    )}
    disabled={disabled}
    onClick={onClick}
    type={type}
  >
    <span className="sr-only">{alt}</span>
    <Image alt="" className="object-contain" fill sizes="(max-width: 768px) 78vw, 593px" src={src} />
  </button>
);

export const AuthTextButtonLink = ({
  href,
  src,
  alt,
  className
}: {
  href: string;
  src: string;
  alt: string;
  className?: string;
}) => (
  <Link className={cn('relative block transition duration-200 hover:scale-[1.02]', className)} href={href}>
    <span className="sr-only">{alt}</span>
    <Image alt="" className="object-contain" fill sizes="(max-width: 768px) 42vw, 246px" src={src} />
  </Link>
);
