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
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      apiClient('/bookings?page=1&limit=5'),
      apiClient('/bookings?page=1&limit=1&status=PENDING'),
      apiClient('/hotels?page=1&limit=1'),
      apiClient('/users?page=1&limit=1'),
      ...STATUS_LIST.map((status) => apiClient(`/bookings?page=1&limit=1&status=${status}`)),
    ])
      .then(([bookingsRes, pendingRes, hotelsRes, usersRes, ...statusResults]) => {
        setRecentBookings(bookingsRes.data || []);
        setStats({
          bookings: bookingsRes.meta?.total ?? bookingsRes.data?.length ?? 0,
          pendingBookings: pendingRes.meta?.total ?? 0,
          hotels: hotelsRes.meta?.total ?? hotelsRes.data?.length ?? 0,
          users: usersRes.meta?.total ?? usersRes.data?.length ?? 0,
        });
        setStatusCounts(
          Object.fromEntries(
            STATUS_LIST.map((status, i) => [status, statusResults[i]?.meta?.total ?? 0]),
          ),
        );
      })
      .catch(() => setStats({ bookings: 0, pendingBookings: 0, hotels: 0, users: 0 }))
      .finally(() => setLoading(false));
  }, []);

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
  ];

  return (
    <AdminLayout locale={locale}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.dashboard')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('admin.welcome')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.key} href={`/${locale}${card.href}`}>
              <div className={`rounded-xl ${card.color} p-5 text-white shadow-sm transition hover:opacity-90`}>
                <p className="text-3xl font-bold">
                  {loading ? '—' : card.value}
                </p>
                <p className="mt-1 text-sm font-medium text-white/90">{t(card.key)}</p>
              </div>
            </Link>
          ))}
        </div>

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
