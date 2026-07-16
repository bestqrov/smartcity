import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminSettings } from '@/components/AdminSettings';

export default function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <AdminSettings />
    </AdminLayout>
  );
}
