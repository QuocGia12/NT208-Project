import Link from 'next/link';
import type { ReactNode } from 'react';

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  alternateActionLabel: string;
  alternateActionHref: string;
  alternateActionText: string;
};

export const AuthShell = ({
  title,
  subtitle,
  children,
  alternateActionLabel,
  alternateActionHref,
  alternateActionText
}: AuthShellProps) => {
  return (
    <main className="auth-bg relative min-h-screen overflow-hidden px-4 py-4 text-slate-100 mobile-l:py-5 sm:px-6 desktop-sm:py-8 desktop:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.34),rgba(2,6,23,0.58))]" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-5xl items-center justify-center mobile-l:min-h-[calc(100dvh-2.5rem)] desktop-sm:min-h-[calc(100dvh-4rem)] desktop:min-h-[calc(100dvh-5rem)]">
        <section className="moba-panel w-full max-w-md rounded-2xl p-4 mobile-l:p-6 desktop-sm:p-8 desktop:p-10">
          <div className="mb-8 space-y-2 text-center">
            <p className="moba-heading text-xs uppercase tracking-[0.35em] text-cyan-300/90">
              Zodiac Arena
            </p>
            <h1 className="moba-heading text-3xl uppercase tracking-[0.14em] text-amber-200 sm:text-4xl">
              {title}
            </h1>
            <p className="text-sm text-slate-300/85">{subtitle}</p>
          </div>

          {children}

          <p className="mt-7 text-center text-sm text-slate-300/85">
            {alternateActionLabel}{' '}
            <Link
              className="font-semibold uppercase tracking-[0.08em] text-cyan-300 transition hover:text-cyan-200"
              href={alternateActionHref}
            >
              {alternateActionText}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
};
