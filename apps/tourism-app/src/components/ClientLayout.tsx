'use client';

import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

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
      <Footer locale={locale} />
    </AuthProvider>
  );
}
