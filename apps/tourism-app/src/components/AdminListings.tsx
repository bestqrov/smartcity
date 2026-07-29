'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface Listing {
  id: string;
  name: string;
  type: string;
  city: string | null;
  price: number;
  isAvailable: boolean;
  hotel: { id: string; name: string } | null;
}

interface Hotel {
  id: string;
  name: string;
}

const ACTIVITY_TYPES = [
  'EXCURSION',
  'WELLNESS',
  'SPORT',
  'CULTURAL',
  'CULINARY',
  'ADVENTURE',
  'ENTERTAINMENT',
  'WORKSHOP',
  'SHOPPING',
];

const MARKETPLACE_TARGET = 'marketplace';

export function AdminListings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [listings, setListings] = useState<Listing[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    type: 'EXCURSION',
    target: MARKETPLACE_TARGET,
    city: '',
    price: '',
    maxParticipants: '1',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchListings = () => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      apiClient(`/activities/search?tenantId=${user.tenantId}&includeInactive=true&limit=100`),
      apiClient(`/hotels?tenantId=${user.tenantId}&limit=100`),
    ])
      .then(([activitiesRes, hotelsRes]) => {
        setListings(activitiesRes.data || []);
        setHotels(hotelsRes.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchListings();
  }, [user?.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const isPrivate = form.target !== MARKETPLACE_TARGET;
      await apiClient('/activities', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          ...(isPrivate ? { hotelId: form.target } : { city: form.city }),
          price: Number(form.price),
          maxParticipants: Number(form.maxParticipants) || 1,
          description: form.description || undefined,
        }),
      });
      setForm({
        name: '',
        type: 'EXCURSION',
        target: MARKETPLACE_TARGET,
        city: '',
        price: '',
        maxParticipants: '1',
        description: '',
      });
      fetchListings();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm(t('common.delete') + '?')) return;

    try {
      await apiClient(`/activities/${id}`, { method: 'DELETE' });
      fetchListings();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (!user?.tenantId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        {t('listings.noTenant')}
      </div>
    );
  }

  if (loading) {
    return <div className="py-12 text-center text-gray-500">{t('common.loading')}</div>;
  }

  const isPrivateTarget = form.target !== MARKETPLACE_TARGET;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t('listings.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('listings.subtitle')}</p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>{t('listings.newListing')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label={t('listings.name')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('listings.visibility')}
                </label>
                <select
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value={MARKETPLACE_TARGET}>{t('listings.marketplaceOption')}</option>
                  {hotels.map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {t('listings.privateOption', { hotel: hotel.name })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isPrivateTarget ? (
              <p className="text-xs text-gray-500">{t('listings.privateHint')}</p>
            ) : (
              <Input
                label={t('listings.city')}
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Marrakech"
                required
              />
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('admin.type')}</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label={t('billing.planPrice')}
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
              <Input
                label={t('listings.maxParticipants')}
                type="number"
                min="1"
                value={form.maxParticipants}
                onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('admin.description')}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <Button type="submit" loading={submitting}>
              {t('listings.createListing')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t('listings.myListings')} ({listings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listings.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">{t('listings.noListings')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left">{t('listings.name')}</th>
                    <th className="px-3 py-2 text-left">{t('admin.type')}</th>
                    <th className="px-3 py-2 text-left">{t('listings.visibility')}</th>
                    <th className="px-3 py-2 text-left">{t('billing.planPrice')}</th>
                    <th className="px-3 py-2 text-left">{t('myBookings.status')}</th>
                    <th className="px-3 py-2 text-right">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => (
                    <tr key={listing.id} className="border-b last:border-0">
                      <td className="px-3 py-3">{listing.name}</td>
                      <td className="px-3 py-3">{listing.type}</td>
                      <td className="px-3 py-3">
                        {listing.hotel ? listing.hotel.name : listing.city || '—'}
                      </td>
                      <td className="px-3 py-3">{listing.price} MAD</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            listing.isAvailable
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {listing.isAvailable ? t('admin.statusActive') : t('admin.statusInactive')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {listing.isAvailable && (
                          <Button variant="danger" size="sm" onClick={() => handleDeactivate(listing.id)}>
                            {t('common.delete')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
