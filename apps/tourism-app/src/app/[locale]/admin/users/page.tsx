import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminUsers } from '@/components/AdminUsers';

export default function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <AdminUsers />
    </AdminLayout>
  );
}
