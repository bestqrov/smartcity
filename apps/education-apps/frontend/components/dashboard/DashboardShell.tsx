'use client';

// Espresso dashboard shell shared by the sales agent space and the super admin platform dashboard:
// sidebar (inline start, so on the right in Arabic) or top bar on small screens, FR/ع and theme toggles,
// logout, and the credit line.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Moon, Sun, type LucideIcon } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { AgentAvatar } from '@/components/agent/AgentAvatar';
import type { DashboardLang, DashboardTheme } from '@/lib/dashboard/prefs';

export const CREDIT = 'Powered by Ariss BH Multiservice';

export interface ShellStrings {
    brand: string;
    nav_label: string;
    logout: string;
    lang_switch: string;
    lang_switch_label: string;
    theme_to_dark: string;
    theme_to_light: string;
}

export interface ShellNavItem {
    key: string;
    label: string;
    icon: LucideIcon;
    href: string;
    active: boolean;
    onClick?: () => void;
}

interface Props {
    lang: DashboardLang;
    setLang: (lang: DashboardLang) => void;
    theme: DashboardTheme;
    toggleTheme: () => void;
    m: ShellStrings;
    nav: ShellNavItem[];
    userName?: string | null;
    avatar?: string | null;
    // Optional shortcut to another space (e.g. back to the school), shown under the nav.
    extraLink?: { label: string; href: string; icon: LucideIcon };
    children: React.ReactNode;
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-200';

export function DashboardShell({ lang, setLang, theme, toggleTheme, m, nav, userName, avatar, extraLink, children }: Props) {
    const router = useRouter();

    const logout = () => {
        useAuthStore.getState().logout();
        router.push('/login');
    };

    const toggles = (variant: 'sidebar' | 'bar') => {
        const btn =
            variant === 'sidebar'
                ? `flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-espresso-50 hover:bg-white/20 ${focusRing}`
                : `flex h-10 w-10 items-center justify-center rounded-full text-espresso-50 hover:bg-white/10 ${focusRing}`;
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
                        <AgentAvatar src={avatar} name={userName} size={56} className="bg-espresso-50 text-espresso-800 dark:bg-espresso-200 dark:text-espresso-950" />
                        <div className="text-sm font-extrabold">{m.brand}</div>
                        {userName && <div className="max-w-full truncate text-xs text-espresso-200">{userName}</div>}
                    </div>
                    <nav aria-label={m.nav_label} className="mt-6 flex-1 space-y-1 overflow-y-auto">
                        {nav.map((item) => {
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    onClick={item.onClick}
                                    aria-current={item.active ? 'page' : undefined}
                                    className={`ms-3 flex items-center gap-3 rounded-s-full px-4 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-espresso-400 ${
                                        item.active ? 'bg-espresso-50 text-espresso-800 dark:bg-espresso-950 dark:text-espresso-50' : 'text-espresso-50 hover:bg-white/10'
                                    }`}
                                >
                                    <Icon size={17} aria-hidden="true" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                    {extraLink && (
                        <Link href={extraLink.href} className={`mx-4 mt-3 flex items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-espresso-50 hover:bg-white/20 ${focusRing}`}>
                            <extraLink.icon size={16} aria-hidden="true" />
                            {extraLink.label}
                        </Link>
                    )}
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
                                <AgentAvatar src={avatar} name={userName} size={32} className="bg-espresso-50 text-espresso-800 dark:bg-espresso-200 dark:text-espresso-950" />
                                <div className="min-w-0 leading-tight">
                                    <div className="truncate text-sm font-extrabold">{m.brand}</div>
                                    {userName && <div className="truncate text-[11px] text-espresso-200">{userName}</div>}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">{toggles('bar')}</div>
                        </div>
                        <nav aria-label={m.nav_label} className="flex gap-1 overflow-x-auto px-3 pb-2">
                            {nav.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={item.key}
                                        href={item.href}
                                        onClick={item.onClick}
                                        aria-current={item.active ? 'page' : undefined}
                                        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${focusRing} ${
                                            item.active ? 'bg-espresso-50 text-espresso-800 dark:bg-espresso-200 dark:text-espresso-950' : 'bg-white/10 text-espresso-50 hover:bg-white/20'
                                        }`}
                                    >
                                        <Icon size={14} aria-hidden="true" />
                                        {item.label}
                                    </Link>
                                );
                            })}
                            {extraLink && (
                                <Link href={extraLink.href} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/30 px-3 py-2 text-xs font-bold text-espresso-50 hover:bg-white/20 ${focusRing}`}>
                                    <extraLink.icon size={14} aria-hidden="true" />
                                    {extraLink.label}
                                </Link>
                            )}
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

// Title banner at the top of a dashboard page.
export function DashboardBanner({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
    return (
        <header className="flex justify-center">
            <div className="w-full max-w-2xl rounded-2xl bg-espresso-800 px-5 py-3 text-center text-white shadow-sm dark:bg-espresso-ink sm:rounded-full">
                <h1 className="text-lg font-extrabold sm:text-2xl">{title}</h1>
                {subtitle && <p className="mt-0.5 text-xs text-espresso-100 sm:text-sm">{subtitle}</p>}
            </div>
        </header>
    );
}
