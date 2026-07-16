'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { BookingCard } from '@/components/BookingCard';
import { Button } from '@/components/ui/Button';

interface Booking {
  id: string;
  hotel: { name: string };
  room: { name: string };
  checkIn: string;
  checkOut: string;
  status: string;
  totalPrice: number;
}

export function BookingsList({ locale }: { locale: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    apiClient(`/bookings?guestId=${user.id}`)
      .then((response) => {
        setBookings(response.data || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('common.error'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, authLoading, locale, router, t]);

  if (loading || authLoading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">{t('myBookings.title')}</h1>
        <Button onClick={() => router.push(`/${locale}/hotels`)} variant="outline">
          {t('common.browseHotels')}
        </Button>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-600 mb-4">{t('myBookings.noBookings')}</p>
          <Button onClick={() => router.push(`/${locale}/hotels`)}>
            {t('common.discoverHotels')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              bookingId={booking.id}
              locale={locale}
              hotelName={booking.hotel.name}
              roomName={booking.room.name}
              checkIn={booking.checkIn}
              checkOut={booking.checkOut}
              status={booking.status}
              totalPrice={booking.totalPrice}
            />
          ))}
        </div>
      )}
    </div>
  );
}
