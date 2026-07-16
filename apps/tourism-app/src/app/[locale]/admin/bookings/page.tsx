import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminBookings } from '@/components/AdminBookings';

export default function AdminBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <AdminBookings />
    </AdminLayout>
  );
}
