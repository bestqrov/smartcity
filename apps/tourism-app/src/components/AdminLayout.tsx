'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

interface AdminLayoutProps {
  children: React.ReactNode;
  locale: string;
}

const adminLinks = [
  { href: '/admin', key: 'admin.dashboard' },
  { href: '/admin/hotels', key: 'admin.hotels' },
  { href: '/admin/bookings', key: 'admin.bookings' },
  { href: '/admin/users', key: 'admin.users' },
  { href: '/admin/settings', key: 'admin.settings' },
  { href: '/admin/scan', key: 'admin.scan' },
];

export function AdminLayout({ children, locale }: AdminLayoutProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];
    if (!allowedRoles.includes(user.role)) {
      router.push(`/${locale}`);
    }
  }, [user, isLoading, locale, router]);

  if (isLoading || !user) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];
  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={`/${locale}${link.href}`}
                className="block px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                {t(link.key as any)}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
