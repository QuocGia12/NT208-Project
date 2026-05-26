import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { GlobalClickSfx } from '@/components/app/global-click-sfx';
import './globals.css';

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
      <body>
        <GlobalClickSfx />
        {children}
      </body>
    </html>
  );
}
