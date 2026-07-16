import * as React from 'react';
import { notFound } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { BookingForm } from '@/components/BookingForm';

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  let hotel;

  try {
    hotel = await apiClient(`/hotels/${id}`);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BookingForm locale={locale} hotelId={id} hotelName={hotel.name} />
    </div>
  );
}
