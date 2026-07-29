'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui';
import { Card, CardContent } from '@/components/ui/Card';

interface ServiceOrder {
  id: string;
  type: string;
  quantity: number;
  price: number;
  status: string;
}

interface Booking {
  id: string;
  status: string;
  hotel: { name: string; address: string; city: string };
  room: { name: string };
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  serviceOrders: ServiceOrder[];
}

export function BookingInvoice({ locale, bookingId }: { locale: string; bookingId: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    apiClient(`/bookings/${bookingId}`)
      .then((data) => setBooking(data))
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  }, [authLoading, user, locale, router, bookingId, t]);

  if (loading || authLoading) {
    return <div className="py-12 text-center text-gray-500">{t('common.loading')}</div>;
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error || t('common.error')}
        </div>
      </div>
    );
  }

  const activeOrders = booking.serviceOrders.filter((o) => o.status !== 'CANCELLED');
  const ordersTotal = activeOrders.reduce((sum, o) => sum + o.price * o.quantity, 0);
  const grandTotal = booking.totalPrice + ordersTotal;

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 print:py-0">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">{t('services.invoice')}</h1>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          {t('services.print')}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{booking.hotel.name}</h2>
            <p className="text-sm text-gray-500">
              {booking.hotel.address}, {booking.hotel.city}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">{t('booking.checkIn')}</p>
              <p className="font-medium text-gray-800">{formatDate(booking.checkIn)}</p>
            </div>
            <div>
              <p className="text-gray-500">{t('booking.checkOut')}</p>
              <p className="font-medium text-gray-800">{formatDate(booking.checkOut)}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-gray-600">{booking.room.name}</span>
              <span className="font-medium text-gray-800">{booking.totalPrice} MAD</span>
            </div>
            {activeOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-1 text-sm">
                <span className="text-gray-600">
                  {order.type} {order.quantity > 1 ? `×${order.quantity}` : ''}
                </span>
                <span className="font-medium text-gray-800">
                  {order.price * order.quantity} MAD
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="text-base font-semibold text-gray-900">{t('services.total')}</span>
            <span className="text-xl font-bold text-primary-600">{grandTotal} MAD</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
