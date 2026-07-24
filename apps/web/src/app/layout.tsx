import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meeting AI',
  description: 'AI-powered meeting assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
