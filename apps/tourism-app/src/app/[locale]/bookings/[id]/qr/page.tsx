import * as React from 'react';
import { BookingQr } from '@/components/BookingQr';

export default function BookingQrPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = React.use(params);

  return <BookingQr locale={locale} bookingId={id} />;
}
