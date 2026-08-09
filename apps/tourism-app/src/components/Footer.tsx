'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

export function Footer({ locale }: { locale: string }) {
  const { t } = useTranslation();

  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-lg font-bold bg-gradient-to-r from-primary-300 to-primary-500 bg-clip-text text-transparent">
          {t('common.appName')} {t('tourism.hotels')}
        </span>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <Link href={`/${locale}/hotels`} className="hover:text-white transition-colors">
            {t('tourism.hotels')}
          </Link>
          <Link href={`/${locale}/login`} className="hover:text-white transition-colors">
            {t('common.login')}
          </Link>
        </div>
        <span className="text-sm text-gray-500">
          © {new Date().getFullYear()} {t('common.appName')}
        </span>
      </div>
    </footer>
  );
}
