import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminHousekeeping } from '@/components/AdminHousekeeping';

export default function AdminHousekeepingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <AdminHousekeeping />
    </AdminLayout>
  );
}
