import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminMessages } from '@/components/AdminMessages';

export default function AdminMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <AdminMessages />
    </AdminLayout>
  );
}
