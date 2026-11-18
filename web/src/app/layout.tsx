import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = { title: { default: 'LEA Study', template: '%s · LEA Study' }, description: 'Personal academic learning environment for L3 LEA, international business.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f8f2e7' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-ivory text-ink">{children}</body>
    </html>
  );
}
