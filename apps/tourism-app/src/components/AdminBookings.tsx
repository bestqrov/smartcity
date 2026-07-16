'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface Booking {
  id: string;
  guest: { firstName: string; lastName: string; email: string };
  hotel: { name: string };
  room: { name: string };
  checkIn: string;
  checkOut: string;
  status: string;
  totalPrice: number;
}

const STATUS_OPTIONS = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];

export function AdminBookings() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBookings = () => {
    setLoading(true);
    apiClient('/bookings?page=1&limit=100')
      .then((response) => setBookings(response.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiClient(`/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      fetchBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.delete') + '?')) return;

    try {
      await apiClient(`/bookings/${id}`, { method: 'DELETE' });
      fetchBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('admin.manageBookings')}</h1>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.bookings')} ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">{t('myBookings.guest')}</th>
                  <th className="text-left py-2 px-3">{t('myBookings.hotel')}</th>
                  <th className="text-left py-2 px-3">{t('myBookings.dates')}</th>
                  <th className="text-left py-2 px-3">{t('myBookings.price')}</th>
                  <th className="text-left py-2 px-3">{t('myBookings.status')}</th>
                  <th className="text-right py-2 px-3">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-b last:border-0">
                    <td className="py-3 px-3">
                      {booking.guest.firstName} {booking.guest.lastName}
                      <br />
                      <span className="text-sm text-gray-500">{booking.guest.email}</span>
                    </td>
                    <td className="py-3 px-3">{booking.hotel.name}</td>
                    <td className="py-3 px-3">
                      {new Date(booking.checkIn).toLocaleDateString('fr-FR')} → {new Date(booking.checkOut).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 px-3">{booking.totalPrice} MAD</td>
                    <td className="py-3 px-3">
                      <select
                        value={booking.status}
                        onChange={(e) => handleStatusChange(booking.id, e.target.value)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(booking.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
