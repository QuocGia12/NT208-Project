import type { Metadata } from 'next';
import { Baloo_2, Be_Vietnam_Pro, Lilita_One, Lora, Open_Sans, Playpen_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import { GlobalClickSfx } from '@/components/app/global-click-sfx';
import './globals.css';

const baloo2 = Baloo_2({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700', '800'],
  variable: '--font-baloo-2',
  display: 'swap'
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam-pro',
  display: 'swap'
});

const openSans = Open_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-open-sans',
  display: 'swap'
});

const lilitaOne = Lilita_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-lilita-one',
  display: 'swap'
});

const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap'
});

const playpenSans = Playpen_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-playpen-sans',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Cuoc Dua 12 Con Giap',
  description: 'Frontend shell for Cuoc Dua 12 Con Giap'
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi">
      <body
        className={[
          baloo2.variable,
          beVietnamPro.variable,
          openSans.variable,
          lilitaOne.variable,
          lora.variable,
          playpenSans.variable
        ].join(' ')}
      >
        <GlobalClickSfx />
        {children}
      </body>
    </html>
  );
}
