'use client';

import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';

export function ClientLayout({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  return (
    <AuthProvider>
      <Navbar locale={locale} />
      <main className="min-h-screen">{children}</main>
    </AuthProvider>
  );
}
