import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartCity Tourism',
  description: 'Discover hotels, rooms, restaurants and activities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
