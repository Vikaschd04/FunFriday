import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { LiveRegionProvider, SkipLink } from '@funfriday/ui';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  title: {
    default: 'FunFriday - Connect Beyond Work',
    template: '%s - FunFriday',
  },
  description:
    'Short, inclusive games that help teams relax, laugh and get to know each other. FunFriday is a preview build.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Per-request rendering so proxy.ts's CSP nonce reaches every framework script.
  await connection();
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable}`}>
      <body>
        <SkipLink />
        <LiveRegionProvider>{children}</LiveRegionProvider>
      </body>
    </html>
  );
}
