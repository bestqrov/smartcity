import * as React from 'react';
import { BookingInvoice } from '@/components/BookingInvoice';

export default function BookingInvoicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = React.use(params);

  return <BookingInvoice locale={locale} bookingId={id} />;
}
