import type { Metadata } from 'next';
import Providers from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meeting AI',
  description: 'AI-ассистент для встреч',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
