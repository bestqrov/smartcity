'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface ServiceOrder {
  id: string;
  type: string;
  description: string | null;
  quantity: number;
  price: number;
  status: string;
  rating: number | null;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  text: string;
  senderRole: string;
  createdAt: string;
}

interface Booking {
  id: string;
  hotelId: string;
  status: string;
  hotel: { name: string; city: string };
  room: { name: string };
  checkIn: string;
  checkOut: string;
  serviceOrders: ServiceOrder[];
}

interface HotelItem {
  id: string;
  name: string;
  type: string;
  price: number;
  description: string | null;
}

interface MarketplaceActivity {
  id: string;
  name: string;
  type: string;
  price: number;
  description: string | null;
  tenant: { id: string; name: string; type: string };
}

interface MarketplaceRestaurant {
  id: string;
  name: string;
  cuisine: string[];
  priceRange: string | null;
  tenant: { id: string; name: string; type: string };
}

interface CatalogItem {
  key: string;
  type: string;
  labelKey: string;
  price: number;
}

const CATALOG: CatalogItem[] = [
  { key: 'breakfast', type: 'Petit-déjeuner', labelKey: 'services.breakfast', price: 80 },
  { key: 'roomService', type: 'Room Service', labelKey: 'services.roomService', price: 120 },
  { key: 'spa', type: 'Spa', labelKey: 'services.spa', price: 350 },
  { key: 'lateCheckout', type: 'Late Check-out', labelKey: 'services.lateCheckout', price: 100 },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  PREPARING: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const POLL_INTERVAL_MS = 8000;

export function BookingServices({ locale, bookingId }: { locale: string; bookingId: string }) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ordering, setOrdering] = useState<string | null>(null);
  const [marketActivities, setMarketActivities] = useState<MarketplaceActivity[]>([]);
  const [marketRestaurants, setMarketRestaurants] = useState<MarketplaceRestaurant[]>([]);
  const [hotelItems, setHotelItems] = useState<HotelItem[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [rating, setRating] = useState<string | null>(null);

  const fetchBooking = useCallback(() => {
    return apiClient(`/bookings/${bookingId}`)
      .then((data) => setBooking(data))
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')));
  }, [bookingId, t]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    fetchBooking().finally(() => setLoading(false));

    const interval = setInterval(fetchBooking, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [authLoading, user, locale, router, fetchBooking]);

  const fetchMessages = useCallback(() => {
    return apiClient(`/messages?bookingId=${bookingId}`)
      .then((data) => setMessages(data || []))
      .catch(() => {});
  }, [bookingId]);

  useEffect(() => {
    if (authLoading || !user) return;

    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [authLoading, user, fetchMessages]);

  useEffect(() => {
    const city = booking?.hotel.city;
    if (!city) return;

    apiClient(`/activities?city=${encodeURIComponent(city)}&limit=20`)
      .then((res) => setMarketActivities(res.data || []))
      .catch(() => setMarketActivities([]));

    apiClient(`/restaurants?city=${encodeURIComponent(city)}&limit=20`)
      .then((res) => setMarketRestaurants(res.data || []))
      .catch(() => setMarketRestaurants([]));
  }, [booking?.hotel.city]);

  useEffect(() => {
    const hotelId = booking?.hotelId;
    if (!hotelId) return;

    apiClient(`/activities/${hotelId}/hotel?limit=50`)
      .then((res) => setHotelItems(res.data || []))
      .catch(() => setHotelItems([]));
  }, [booking?.hotelId]);

  const handleOrder = async (item: CatalogItem) => {
    setOrdering(item.key);
    setError('');
    try {
      await apiClient('/orders', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          type: item.type,
          quantity: 1,
          price: item.price,
        }),
      });
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setOrdering(null);
    }
  };

  const handleHotelItemOrder = async (item: HotelItem) => {
    setOrdering(item.id);
    setError('');
    try {
      await apiClient('/orders', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          type: item.name,
          quantity: 1,
          price: item.price,
        }),
      });
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setOrdering(null);
    }
  };

  const handleMarketActivityOrder = async (activity: MarketplaceActivity) => {
    setOrdering(activity.id);
    setError('');
    try {
      await apiClient('/orders', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          type: activity.name,
          description: activity.tenant.name,
          quantity: 1,
          price: activity.price,
        }),
      });
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setOrdering(null);
    }
  };

  const handleRestaurantReservation = async (restaurant: MarketplaceRestaurant) => {
    setOrdering(restaurant.id);
    setError('');
    try {
      await apiClient('/orders', {
        method: 'POST',
        body: JSON.stringify({
          bookingId,
          type: `${t('services.reservation')}: ${restaurant.name}`,
          description: restaurant.tenant.name,
          quantity: 1,
          price: 0,
        }),
      });
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setOrdering(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setSendingMessage(true);
    try {
      await apiClient('/messages', {
        method: 'POST',
        body: JSON.stringify({ bookingId, text: messageText.trim() }),
      });
      setMessageText('');
      await fetchMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleRate = async (orderId: string, value: number) => {
    setRating(orderId);
    setError('');
    try {
      await apiClient(`/orders/${orderId}/rating`, {
        method: 'PATCH',
        body: JSON.stringify({ rating: value }),
      });
      await fetchBooking();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setRating(null);
    }
  };

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

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{booking.hotel.name}</h1>
          <p className="text-sm text-gray-500">
            {booking.room.name} · {booking.hotel.city}
          </p>
        </div>
        <Link
          href={`/${locale}/bookings/${bookingId}/invoice`}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          {t('services.viewInvoice')}
        </Link>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>{t('services.orderTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CATALOG.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <p className="font-medium text-gray-800">{t(item.labelKey)}</p>
                  <p className="text-sm text-gray-500">{item.price} MAD</p>
                </div>
                <Button
                  size="sm"
                  loading={ordering === item.key}
                  disabled={booking.status === 'CANCELLED'}
                  onClick={() => handleOrder(item)}
                >
                  {t('services.order')}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {hotelItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('services.hotelMenu')}</CardTitle>
            <p className="text-sm text-gray-500">{t('services.hotelMenuSubtitle')}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {hotelItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-gray-400">{item.description}</p>
                  )}
                  <p className="text-sm text-gray-500">{item.price} MAD</p>
                </div>
                <Button
                  size="sm"
                  loading={ordering === item.id}
                  disabled={booking.status === 'CANCELLED'}
                  onClick={() => handleHotelItemOrder(item)}
                >
                  {t('services.order')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(marketActivities.length > 0 || marketRestaurants.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{t('services.marketplace')}</CardTitle>
            <p className="text-sm text-gray-500">{t('services.marketplaceSubtitle')}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {marketActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <p className="font-medium text-gray-800">{activity.name}</p>
                  <p className="text-xs text-gray-400">
                    {activity.tenant.name} · {activity.type}
                  </p>
                  <p className="text-sm text-gray-500">{activity.price} MAD</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={ordering === activity.id}
                  disabled={booking.status === 'CANCELLED'}
                  onClick={() => handleMarketActivityOrder(activity)}
                >
                  {t('services.order')}
                </Button>
              </div>
            ))}
            {marketRestaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div>
                  <p className="font-medium text-gray-800">{restaurant.name}</p>
                  <p className="text-xs text-gray-400">
                    {restaurant.tenant.name}
                    {restaurant.cuisine.length > 0 ? ` · ${restaurant.cuisine.join(', ')}` : ''}
                  </p>
                  {restaurant.priceRange && (
                    <p className="text-sm text-gray-500">{restaurant.priceRange}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={ordering === restaurant.id}
                  disabled={booking.status === 'CANCELLED'}
                  onClick={() => handleRestaurantReservation(restaurant)}
                >
                  {t('services.reserve')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('services.myOrders')}</CardTitle>
        </CardHeader>
        <CardContent>
          {booking.serviceOrders.length === 0 ? (
            <p className="text-sm text-gray-500">{t('services.noOrders')}</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {booking.serviceOrders
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((order) => (
                  <li key={order.id} className="flex flex-col gap-2 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{order.type}</p>
                        <p className="text-sm text-gray-500">{order.price} MAD</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    {order.status === 'DELIVERED' && !order.rating && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">{t('services.rateOrder')}</span>
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={rating === order.id}
                            onClick={() => handleRate(order.id, value)}
                            className="text-lg text-amber-400 hover:scale-110 disabled:opacity-50"
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    )}
                    {order.rating && (
                      <p className="text-xs text-amber-500">
                        {'★'.repeat(order.rating)}
                        {'☆'.repeat(5 - order.rating)}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('services.chatTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">{t('services.noMessages')}</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderRole === 'GUEST' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      msg.senderRole === 'GUEST'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={t('services.messagePlaceholder')}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm" loading={sendingMessage}>
              {t('services.send')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
