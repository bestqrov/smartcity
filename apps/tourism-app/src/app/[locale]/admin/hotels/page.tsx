import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminHotels } from '@/components/AdminHotels';

export default function AdminHotelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <AdminHotels locale={locale} />
    </AdminLayout>
  );
}
