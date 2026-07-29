import * as React from 'react';
import { BookingServices } from '@/components/BookingServices';

export default function BookingServicesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = React.use(params);

  return <BookingServices locale={locale} bookingId={id} />;
}
