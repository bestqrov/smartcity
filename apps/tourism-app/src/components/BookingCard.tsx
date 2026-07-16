import Link from 'next/link';
import React, { type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';

interface BookingCardProps {
  bookingId: string;
  locale: string;
  hotelName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalPrice: number;
  actions?: ReactNode;
}

export function BookingCard({
  bookingId,
  locale,
  hotelName,
  roomName,
  checkIn,
  checkOut,
  status,
  totalPrice,
  actions,
}: BookingCardProps) {
  const { t } = useTranslation();
  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    CHECKED_IN: 'bg-blue-100 text-blue-700',
    CHECKED_OUT: 'bg-gray-100 text-gray-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-900">{hotelName}</h3>
          <p className="text-sm text-gray-600">{t('myBookings.room')}: {roomName}</p>
          <p className="text-sm text-gray-500">
            {formatDate(checkIn)} → {formatDate(checkOut)}
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}
          >
            {status}
          </span>
          <span className="text-lg font-bold text-primary-600">{totalPrice} MAD</span>
        </div>
      </div>

      {actions && <div className="mt-4 flex items-center gap-3">{actions}</div>}
      {!actions && status !== 'CANCELLED' && (
        <div className="mt-4 flex items-center gap-3">
          <Link
            href={`/${locale}/bookings/${bookingId}/qr`}
            className="text-sm text-primary-600 hover:underline"
          >
            {t('myBookings.viewQr')}
          </Link>
        </div>
      )}
    </div>
  );
}
