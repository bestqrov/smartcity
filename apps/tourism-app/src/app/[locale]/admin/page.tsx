'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useTranslation } from '@/lib/i18n';

export default function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { t } = useTranslation();

  return (
    <AdminLayout locale={locale}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t('admin.dashboard')}</h1>
        <p className="text-gray-600">
          {t('admin.welcome')}
        </p>
      </div>
    </AdminLayout>
  );
}
