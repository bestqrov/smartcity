import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { QrScanner } from '@/components/QrScanner';

export default function AdminScanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <QrScanner />
    </AdminLayout>
  );
}
