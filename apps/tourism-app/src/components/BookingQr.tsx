'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface BookingQrProps {
  locale: string;
  bookingId: string;
}

export function BookingQr({ locale, bookingId }: BookingQrProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [qrCode, setQrCode] = useState('');
  const [booking, setBooking] = useState<{
    hotel: { name: string };
    room: { name: string };
    checkIn: string;
    checkOut: string;
    status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    apiClient(`/bookings/${bookingId}`)
      .then((bookingData) => {
        setBooking(bookingData);
        return apiClient(`/qr/${bookingId}`);
      })
      .then((qrData) => {
        setQrCode(qrData.qrCode || '');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('common.error'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user, authLoading, bookingId, locale, router, t]);

  const handleGenerate = async () => {
    try {
      const response = await apiClient('/qr/generate', {
        method: 'POST',
        body: JSON.stringify({ bookingId }),
      });
      setQrCode(response.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (loading || authLoading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={handleGenerate}>{t('qrCode.generate')}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Card className="text-center">
        <CardHeader>
          <CardTitle>{t('qrCode.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {booking && (
            <div className="space-y-1 text-sm text-gray-600">
              <p className="font-medium text-gray-900 text-lg">{booking.hotel.name}</p>
              <p>{t('myBookings.room')}: {booking.room.name}</p>
              <p>
                {new Date(booking.checkIn).toLocaleDateString('fr-FR')} →{' '}
                {new Date(booking.checkOut).toLocaleDateString('fr-FR')}
              </p>
              <p className="capitalize">{t('myBookings.status')}: {booking.status.toLowerCase()}</p>
            </div>
          )}

          {qrCode ? (
            <div className="flex flex-col items-center gap-4">
              <img
                src={qrCode}
                alt={t('qrCode.title')}
                className="w-64 h-64 rounded-lg border border-gray-200"
              />
              <a
                href={qrCode}
                download={`booking-${bookingId}.png`}
                className="text-primary-600 hover:underline"
              >
                {t('qrCode.download')}
              </a>
            </div>
          ) : (
            <div className="py-8">
              <p className="text-gray-600 mb-4">{t('qrCode.noQr')}</p>
              <Button onClick={handleGenerate}>{t('qrCode.generate')}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
