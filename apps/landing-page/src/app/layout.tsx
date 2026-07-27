import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MoroSmartCity — Écosystème digital du Maroc',
  description:
    'MoroSmartCity regroupe tourisme, santé, éducation et services publics dans un seul écosystème digital.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
