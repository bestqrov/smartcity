'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface Order {
  id: string;
  type: string;
  description: string | null;
  quantity: number;
  price: number;
  status: string;
  createdAt: string;
  booking: { id: string; status: string };
}

const STATUS_OPTIONS = ['PENDING', 'PREPARING', 'DELIVERED', 'CANCELLED'];

export function AdminOrders() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = () => {
    setLoading(true);
    apiClient('/orders?page=1&limit=100')
      .then((response) => setOrders(response.data || []))
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiClient(`/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      fetchOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-500">{t('common.loading')}</div>;
  }

  const sorted = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('services.orders')}</h1>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>{t('services.orders')} ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">{t('services.noOrders')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left">{t('services.type')}</th>
                    <th className="px-3 py-2 text-left">{t('myBookings.price')}</th>
                    <th className="px-3 py-2 text-left">{t('myBookings.status')}</th>
                    <th className="px-3 py-2 text-left">{t('services.orderedAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((order) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="px-3 py-3">{order.type}</td>
                      <td className="px-3 py-3">{order.price} MAD</td>
                      <td className="px-3 py-3">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString('fr-FR')}
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
