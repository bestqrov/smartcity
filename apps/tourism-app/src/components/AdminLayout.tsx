'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';

interface AdminLayoutProps {
  children: React.ReactNode;
  locale: string;
}

const adminLinks = [
  { href: '/admin', key: 'admin.dashboard', icon: DashboardIcon },
  { href: '/admin/hotels', key: 'admin.hotels', icon: HotelIcon },
  { href: '/admin/listings', key: 'listings.title', icon: ListingsIcon },
  { href: '/admin/bookings', key: 'admin.bookings', icon: BookingIcon },
  { href: '/admin/orders', key: 'services.orders', icon: OrdersIcon },
  { href: '/admin/users', key: 'admin.users', icon: UsersIcon },
  { href: '/admin/scan', key: 'admin.scan', icon: ScanIcon },
  { href: '/admin/billing', key: 'admin.billing', icon: BillingIcon },
  { href: '/admin/settings', key: 'admin.settings', icon: SettingsIcon },
];

export function AdminLayout({ children, locale }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];
    if (!allowedRoles.includes(user.role)) {
      router.push(`/${locale}`);
    }
  }, [user, isLoading, locale, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        {t('common.loading')}
      </div>
    );
  }

  const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'];
  if (!allowedRoles.includes(user.role)) {
    return null;
  }

  const activeHref = adminLinks
    .filter((link) => pathname === `/${locale}${link.href}` || pathname.startsWith(`/${locale}${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-slate-100">
      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-200 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
            S
          </div>
          <span className="text-lg font-semibold text-white">SmartCity</span>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4">
          {adminLinks.map((link) => {
            const isActive = link.href === activeHref;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={`/${locale}${link.href}`}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
            aria-label="Open sidebar"
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <h1 className="hidden text-lg font-semibold text-gray-800 lg:block">
            {t(adminLinks.find((l) => l.href === activeHref)?.key ?? 'admin.dashboard')}
          </h1>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-800">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {initials || 'U'}
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {t('common.logout')}
            </button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function DashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function HotelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4m8-4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5M16 4.5c1.7.3 3 1.8 3 3.5s-1.3 3.2-3 3.5M20 20c-.5-2.3-1.7-4-3.4-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ScanIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M4 12h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ListingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3v3M15 3v3" strokeLinecap="round" />
    </svg>
  );
}

function OrdersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M6 2l1.5 4h9L18 2M4 6h16l-1.5 14a2 2 0 01-2 1.8H7.5a2 2 0 01-2-1.8L4 6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 10v6M15 10v6" strokeLinecap="round" />
    </svg>
  );
}

function BillingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.43.7.72 1.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
