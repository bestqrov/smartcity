'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';

export function Navbar({ locale }: { locale: string }) {
  const { user, logout, isLoading } = useAuth();
  const { t } = useTranslation();

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href={`/${locale}`} className="text-xl font-bold text-primary-600">
            {t('common.appName')} {t('tourism.hotels')}
          </Link>

          <div className="flex items-center gap-4">
            <Link href={`/${locale}/hotels`} className="text-gray-700 hover:text-primary-600">
              {t('tourism.hotels')}
            </Link>

            {!isLoading && user ? (
              <>
                <Link href={`/${locale}/bookings`} className="text-gray-700 hover:text-primary-600">
                  {t('common.myBookings')}
                </Link>
                {['ADMIN', 'MANAGER', 'STAFF'].includes(user.role) && (
                  <Link href={`/${locale}/admin`} className="text-gray-700 hover:text-primary-600">
                    {t('common.admin')}
                  </Link>
                )}
                <span className="text-sm text-gray-600">
                  {user.firstName} {user.lastName}
                </span>
                <Button variant="outline" size="sm" onClick={logout}>
                  {t('common.logout')}
                </Button>
              </>
            ) : (
              <Link href={`/${locale}/login`}>
                <Button size="sm">{t('common.login')}</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
