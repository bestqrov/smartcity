import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminOrders } from '@/components/AdminOrders';

export default function AdminOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <AdminOrders />
    </AdminLayout>
  );
}
