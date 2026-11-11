'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CreditCard, LayoutDashboard, LogOut, Moon, Percent, Receipt, Sun, UserCircle, Users } from 'lucide-react';
import { RequireRole } from '@/components/auth/RequireRole';
import useAuthStore from '@/store/useAuthStore';
import { AgentPrefsProvider, useAgentPrefs, type AgentSection } from '@/lib/agent/prefs';
import { AgentAvatar } from '@/components/agent/AgentAvatar';
import type { AgentMessages } from '@/lib/agent/messages';

const CREDIT = 'Powered by Ariss BH Multiservice';

type NavItem = { key: AgentSection | 'profile'; label: (m: AgentMessages) => string; icon: typeof Users };
const NAV: NavItem[] = [
    { key: 'overview', label: (m) => m.nav_overview, icon: LayoutDashboard },
    { key: 'clients', label: (m) => m.nav_clients, icon: Users },
    { key: 'commissions', label: (m) => m.nav_commissions, icon: Receipt },
    { key: 'payouts', label: (m) => m.nav_payouts, icon: CreditCard },
    { key: 'rates', label: (m) => m.nav_rates, icon: Percent },
    { key: 'profile', label: (m) => m.nav_profile, icon: UserCircle },
];

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-200';

function Shell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const user = useAuthStore((state) => state.user);
    const { lang, setLang, m, theme, toggleTheme, section, goToSection } = useAgentPrefs();
    const onProfile = pathname?.startsWith('/agent/profile');

    // The login response carries no photo: fetch the full profile once when it is missing.
    const needsProfile = !!user && user.avatar === undefined;
    useEffect(() => {
        if (needsProfile) useAuthStore.getState().getMe();
    }, [needsProfile]);

    useEffect(() => {
        if (user?.role === 'SUPER_ADMIN') router.replace('/admin/sales-agents');
    }, [user, router]);

    const logout = () => {
        useAuthStore.getState().logout();
        router.push('/login');
    };

    const isActive = (key: NavItem['key']) => (key === 'profile' ? !!onProfile : !onProfile && section.id === key);
    const hrefOf = (key: NavItem['key']) => (key === 'profile' ? '/agent/profile' : key === 'overview' ? '/agent' : `/agent#${key}`);
    const onNav = (key: NavItem['key']) => {
        if (key !== 'profile') goToSection(key);
    };

    const toggles = (variant: 'sidebar' | 'bar') => {
        const btn =
            variant === 'sidebar'
                ? `flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-espresso-50 hover:bg-white/20 ${focusRing}`
                : `flex h-9 w-9 items-center justify-center rounded-full text-espresso-50 hover:bg-white/10 ${focusRing}`;
        return (
            <>
                <button type="button" onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')} aria-label={m.lang_switch_label} title={m.lang_switch_label} className={`${btn} text-sm font-bold`}>
                    <span lang={lang === 'fr' ? 'ar' : 'fr'}>{m.lang_switch}</span>
                </button>
                <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? m.theme_to_light : m.theme_to_dark} title={theme === 'dark' ? m.theme_to_light : m.theme_to_dark} className={btn}>
                    {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
                </button>
                <button type="button" onClick={logout} aria-label={m.logout} title={m.logout} className={`${btn} hover:text-red-200`}>
                    <LogOut size={18} aria-hidden="true" className="rtl:-scale-x-100" />
                </button>
            </>
        );
    };

    return (
        <div
            lang={lang}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            className={theme === 'dark' ? 'dark' : ''}
            style={{ fontFamily: lang === 'ar' ? 'Cairo, Inter, system-ui, sans-serif' : 'Inter, Cairo, system-ui, sans-serif' }}
        >
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" />
            <div className="min-h-screen bg-espresso-50 text-espresso-950 dark:bg-espresso-950 dark:text-espresso-50 lg:flex">
                {/* ---- desktop sidebar (inline start: right in Arabic) */}
                <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-espresso-800 py-5 text-espresso-50 dark:bg-espresso-ink lg:flex">
                    <div className="flex flex-col items-center gap-2 px-4 text-center">
                        <AgentAvatar src={user?.avatar} name={user?.name} size={56} className="bg-espresso-50 text-espresso-800 dark:bg-espresso-200 dark:text-espresso-950" />
                        <div className="text-sm font-extrabold">{m.brand}</div>
                        {user?.name && <div className="max-w-full truncate text-xs text-espresso-200">{user.name}</div>}
                    </div>
                    <nav aria-label={m.nav_label} className="mt-6 flex-1 space-y-1 overflow-y-auto">
                        {NAV.map((item) => {
                            const active = isActive(item.key);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.key}
                                    href={hrefOf(item.key)}
                                    onClick={() => onNav(item.key)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`ms-3 flex items-center gap-3 rounded-s-full px-4 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-espresso-400 ${
                                        active ? 'bg-espresso-50 text-espresso-800 dark:bg-espresso-950 dark:text-espresso-50' : 'text-espresso-50 hover:bg-white/10'
                                    }`}
                                >
                                    <Icon size={17} aria-hidden="true" />
                                    {item.label(m)}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="mt-4 flex justify-center gap-2 px-4">{toggles('sidebar')}</div>
                    <p dir="ltr" className="mt-4 px-4 text-center text-[11px] text-espresso-200/80">
                        {CREDIT}
                    </p>
                </aside>

                <div className="flex min-h-screen min-w-0 flex-1 flex-col">
                    {/* ---- mobile / tablet top bar + horizontal nav */}
                    <header className="sticky top-0 z-30 bg-espresso-800 text-espresso-50 shadow-sm dark:bg-espresso-ink lg:hidden">
                        <div className="flex items-center justify-between gap-2 px-4 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <AgentAvatar src={user?.avatar} name={user?.name} size={32} className="bg-espresso-50 text-espresso-800 dark:bg-espresso-200 dark:text-espresso-950" />
                                <div className="min-w-0 leading-tight">
                                    <div className="truncate text-sm font-extrabold">{m.brand}</div>
                                    {user?.name && <div className="truncate text-[11px] text-espresso-200">{user.name}</div>}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">{toggles('bar')}</div>
                        </div>
                        <nav aria-label={m.nav_label} className="flex gap-1 overflow-x-auto px-3 pb-2">
                            {NAV.map((item) => {
                                const active = isActive(item.key);
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.key}
                                        href={hrefOf(item.key)}
                                        onClick={() => onNav(item.key)}
                                        aria-current={active ? 'page' : undefined}
                                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${focusRing} ${
                                            active ? 'bg-espresso-50 text-espresso-800 dark:bg-espresso-200 dark:text-espresso-950' : 'bg-white/10 text-espresso-50 hover:bg-white/20'
                                        }`}
                                    >
                                        <Icon size={14} aria-hidden="true" />
                                        {item.label(m)}
                                    </Link>
                                );
                            })}
                        </nav>
                    </header>

                    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:py-6 lg:px-6">{children}</main>

                    <footer className="px-4 pb-4 text-center lg:hidden">
                        <p dir="ltr" className="text-[11px] text-espresso-700 dark:text-espresso-300">
                            {CREDIT}
                        </p>
                    </footer>
                </div>
            </div>
        </div>
    );
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireRole allowedRoles={['SALES_AGENT']}>
            <AgentPrefsProvider>
                <Shell>{children}</Shell>
            </AgentPrefsProvider>
        </RequireRole>
    );
}
