import * as React from 'react';
import { BookingsList } from '@/components/BookingsList';

export default function BookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);

  return <BookingsList locale={locale} />;
}
