'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { PageLoader } from '@smartcity/ui';
import {
  GraduationCap,
  Building2,
  Users,
  UserRound,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [isLoading, user, router, locale]);

  if (isLoading || !user) {
    return <PageLoader />;
  }

  const navItems = [
    {
      href: `/${locale}/branches`,
      label: t('education.branches'),
      icon: Building2,
      accent: 'text-sky-400',
      activeBg: 'bg-sky-500/10',
      activeBorder: 'border-sky-400',
    },
    {
      href: `/${locale}/students`,
      label: t('education.students'),
      icon: GraduationCap,
      accent: 'text-primary-400',
      activeBg: 'bg-primary-500/10',
      activeBorder: 'border-primary-400',
    },
    {
      href: `/${locale}/guardians`,
      label: t('education.guardians'),
      icon: Users,
      accent: 'text-amber-400',
      activeBg: 'bg-amber-500/10',
      activeBorder: 'border-amber-400',
    },
  ];

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile toggle */}
      <button
        onClick={() => setIsMobileMenuOpen((v) => !v)}
        className="fixed start-4 top-4 z-50 rounded-xl bg-slate-900 p-3 text-white shadow-lg lg:hidden"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-40 flex w-72 shrink-0 flex-col text-slate-300 shadow-2xl transition-transform duration-300 lg:static lg:!translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
        style={{
          background: 'radial-gradient(circle at 0% 0%, #164e3b 0%, #0f172a 55%, #0f172a 100%)',
        }}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner backdrop-blur-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/20">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-white">
                SmartCity {t('education.brandName')}
              </h1>
              <p className="truncate text-xs font-medium text-slate-400">
                {t('education.loginHeading')}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-4">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`group flex items-center gap-3 rounded-xl border-e-4 px-4 py-3 transition-all duration-200 ${
                  active
                    ? `${item.activeBg} ${item.activeBorder} text-white shadow-md`
                    : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div
                  className={`rounded-lg p-2 transition-colors ${
                    active ? 'bg-white/10' : 'bg-white/5 group-hover:bg-white/10'
                  }`}
                >
                  <Icon size={18} className={active ? item.accent : 'text-slate-500'} />
                </div>
                <span className="text-sm font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-xs font-bold text-primary-300">
              {initials || <UserRound size={16} />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[11px] text-slate-500">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="group flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-red-400 transition-all hover:bg-red-500/10"
          >
            <LogOut size={18} className="transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
            <span className="text-sm font-semibold">{t('common.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ms-0">
        <main className="flex-1 p-6 pt-20 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}
