'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface Hotel {
  id: string;
  name: string;
  city: string;
  type: string;
  isActive: boolean;
}

export function AdminHotels({ locale }: { locale: string }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    city: '',
    address: '',
    description: '',
    type: 'HOTEL',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchHotels = () => {
    setLoading(true);
    apiClient('/hotels?page=1&limit=100')
      .then((response) => setHotels(response.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await apiClient('/hotels', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          country: 'Morocco',
          lat: 0,
          lng: 0,
          contactEmail: user?.email || '',
          contactPhone: '',
          amenities: [],
          images: [],
          isActive: true,
        }),
      });
      setForm({ name: '', city: '', address: '', description: '', type: 'HOTEL' });
      fetchHotels();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.delete') + '?')) return;

    try {
      await apiClient(`/hotels/${id}`, { method: 'DELETE' });
      fetchHotels();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (loading) {
    return <div className="text-center py-12">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t('admin.manageHotels')}</h1>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.addHotel')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('admin.name')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                label={t('admin.city')}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                required
              />
            </div>
            <Input
              label={t('admin.address')}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.type')}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="HOTEL">Hotel</option>
                <option value="RIAD">Riad</option>
                <option value="RESORT">Resort</option>
                <option value="APARTMENT">Apartment</option>
                <option value="HOSTEL">Hostel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <Button type="submit" loading={submitting}>{t('admin.createHotel')}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.hotels')} ({hotels.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">{t('admin.name')}</th>
                  <th className="text-left py-2 px-3">{t('admin.city')}</th>
                  <th className="text-left py-2 px-3">{t('admin.type')}</th>
                  <th className="text-left py-2 px-3">{t('myBookings.status')}</th>
                  <th className="text-right py-2 px-3">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {hotels.map((hotel) => (
                  <tr key={hotel.id} className="border-b last:border-0">
                    <td className="py-3 px-3">{hotel.name}</td>
                    <td className="py-3 px-3">{hotel.city}</td>
                    <td className="py-3 px-3">{hotel.type}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${hotel.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
                      >
                        {hotel.isActive ? t('admin.statusActive') : t('admin.statusInactive')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(hotel.id)}
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
