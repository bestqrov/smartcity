'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';

interface Stats {
  bookings: number;
  pendingBookings: number;
  hotels: number;
  users: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
  count: number;
}

interface BookingStats {
  dailyRevenue: DailyRevenue[];
  totalRevenue: number;
  occupancyRate: number;
  totalRooms: number;
  occupiedRooms: number;
}

const STATUS_LIST = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'] as const;

const STATUS_BAR_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500',
  CONFIRMED: 'bg-blue-500',
  CHECKED_IN: 'bg-emerald-500',
  CHECKED_OUT: 'bg-slate-400',
  CANCELLED: 'bg-red-500',
};

interface RecentBooking {
  id: string;
  guest: { firstName: string; lastName: string };
  hotel: { name: string };
  status: string;
  totalPrice: number;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-emerald-100 text-emerald-700',
  CHECKED_OUT: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { t } = useTranslation();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = React.useState<RecentBooking[]>([]);
  const [statusCounts, setStatusCounts] = React.useState<Record<string, number>>({});
  const [bookingStats, setBookingStats] = React.useState<BookingStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchDashboard = React.useCallback(() => {
    return Promise.all([
      apiClient('/bookings?page=1&limit=5'),
      apiClient('/bookings?page=1&limit=1&status=PENDING'),
      apiClient('/hotels?page=1&limit=1'),
      apiClient('/users?page=1&limit=1'),
      apiClient('/bookings/stats?days=14'),
      ...STATUS_LIST.map((status) => apiClient(`/bookings?page=1&limit=1&status=${status}`)),
    ])
      .then(([bookingsRes, pendingRes, hotelsRes, usersRes, statsRes, ...statusResults]) => {
        setRecentBookings(bookingsRes.data || []);
        setStats({
          bookings: bookingsRes.meta?.total ?? bookingsRes.data?.length ?? 0,
          pendingBookings: pendingRes.meta?.total ?? 0,
          hotels: hotelsRes.meta?.total ?? hotelsRes.data?.length ?? 0,
          users: usersRes.meta?.total ?? usersRes.data?.length ?? 0,
        });
        setBookingStats(statsRes);
        setStatusCounts(
          Object.fromEntries(
            STATUS_LIST.map((status, i) => [status, statusResults[i]?.meta?.total ?? 0]),
          ),
        );
      })
      .catch(() => setStats({ bookings: 0, pendingBookings: 0, hotels: 0, users: 0 }));
  }, []);

  React.useEffect(() => {
    fetchDashboard().finally(() => setLoading(false));
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const cards = [
    {
      key: 'admin.totalBookings',
      value: stats?.bookings,
      color: 'bg-blue-600',
      href: '/admin/bookings',
    },
    {
      key: 'admin.pendingBookings',
      value: stats?.pendingBookings,
      color: 'bg-amber-500',
      href: '/admin/bookings',
    },
    {
      key: 'admin.totalHotels',
      value: stats?.hotels,
      color: 'bg-emerald-600',
      href: '/admin/hotels',
    },
    {
      key: 'admin.totalUsers',
      value: stats?.users,
      color: 'bg-rose-600',
      href: '/admin/users',
    },
    {
      key: 'admin.occupancy',
      value: bookingStats ? `${bookingStats.occupancyRate}%` : undefined,
      color: 'bg-indigo-600',
      href: '/admin/housekeeping',
    },
  ];

  return (
    <AdminLayout locale={locale}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.dashboard')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('admin.welcome')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((card) => (
            <Link key={card.key} href={`/${locale}${card.href}`}>
              <div className={`rounded-xl ${card.color} p-5 text-white shadow-sm transition hover:opacity-90`}>
                <p className="text-3xl font-bold">
                  {loading ? '—' : card.value ?? '—'}
                </p>
                <p className="mt-1 text-sm font-medium text-white/90">{t(card.key)}</p>
              </div>
            </Link>
          ))}
        </div>

        <Card>
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900">{t('admin.revenueTrend')}</h2>
            <span className="text-sm font-semibold text-primary-600">
              {loading || !bookingStats ? '—' : `${bookingStats.totalRevenue} MAD`}
            </span>
          </div>
          <div className="p-5">
            {loading || !bookingStats ? (
              <div className="py-8 text-center text-sm text-gray-500">{t('common.loading')}</div>
            ) : (
              <RevenueChart data={bookingStats.dailyRevenue} />
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900">
              {t('admin.bookingsByStatus')}
            </h2>
          </div>
          <div className="space-y-4 p-5">
            {STATUS_LIST.map((status) => {
              const count = statusCounts[status] ?? 0;
              const max = Math.max(...STATUS_LIST.map((s) => statusCounts[s] ?? 0), 1);
              const width = loading ? 0 : Math.max((count / max) * 100, count > 0 ? 4 : 0);
              return (
                <div key={status} className="flex items-center gap-4">
                  <span className="w-28 shrink-0 text-xs font-medium text-gray-600">
                    {status}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${STATUS_BAR_COLORS[status]}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold text-gray-800">
                    {loading ? '—' : count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-gray-100 p-5">
            <h2 className="text-base font-semibold text-gray-900">
              {t('admin.recentBookings')}
            </h2>
            <Link
              href={`/${locale}/admin/bookings`}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              {t('admin.viewAll')}
            </Link>
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('common.loading')}</div>
          ) : recentBookings.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">{t('admin.noBookings')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">{t('myBookings.guest')}</th>
                    <th className="px-5 py-3 font-medium">{t('myBookings.hotel')}</th>
                    <th className="px-5 py-3 font-medium">{t('myBookings.price')}</th>
                    <th className="px-5 py-3 font-medium">{t('myBookings.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-800">
                        {booking.guest.firstName} {booking.guest.lastName}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{booking.hotel.name}</td>
                      <td className="px-5 py-3 text-gray-600">{booking.totalPrice} MAD</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_STYLES[booking.status] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

function RevenueChart({ data }: { data: DailyRevenue[] }) {
  if (data.length === 0) return null;

  const width = 600;
  const height = 160;
  const padding = 24;
  const max = Math.max(...data.map((d) => d.revenue), 1);

  const points = data.map((d, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (d.revenue / max) * (height - padding * 2);
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${height - padding} L${points[0].x},${height - padding} Z`;

  const formatDay = (date: string) =>
    new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 480 }}>
        <path d={areaPath} fill="rgb(37 99 235 / 0.1)" />
        <path d={linePath} fill="none" stroke="rgb(37 99 235)" strokeWidth="2" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="rgb(37 99 235)" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>{formatDay(data[0].date)}</span>
        <span>{formatDay(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}
