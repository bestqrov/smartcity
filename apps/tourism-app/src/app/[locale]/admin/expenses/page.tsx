import * as React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminExpenses } from '@/components/AdminExpenses';

export default function AdminExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return (
    <AdminLayout locale={locale}>
      <AdminExpenses locale={locale} />
    </AdminLayout>
  );
}
