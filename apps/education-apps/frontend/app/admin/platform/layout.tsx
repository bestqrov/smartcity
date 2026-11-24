'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Briefcase, Building, LayoutDashboard, Package, Settings } from 'lucide-react';
import { RequireRole } from '@/components/auth/RequireRole';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import useAuthStore from '@/store/useAuthStore';
import { PlatformPrefsProvider, usePlatformPrefs } from '@/lib/platform/prefs';
import { DECLARATIONS_CHANGED, getPendingDeclarationsCount } from '@/lib/services/paymentDeclarations';

function Shell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const user = useAuthStore((state) => state.user);
    const { lang, setLang, m, theme, toggleTheme } = usePlatformPrefs();

    // The login response carries no photo: fetch the full profile once when it is missing.
    const needsProfile = !!user && user.avatar === undefined;
    useEffect(() => {
        if (needsProfile) useAuthStore.getState().getMe();
    }, [needsProfile]);

    // Platform data is for the super admin only.
    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') router.replace('/admin');
    }, [user, router]);

    // Payments declared by sales agents and waiting for validation: a red count on the dashboard entry.
    const [pending, setPending] = useState(0);
    useEffect(() => {
        if (user?.role !== 'SUPER_ADMIN') return;
        const refresh = () => getPendingDeclarationsCount().then(setPending).catch(() => {});
        refresh();
        const timer = window.setInterval(refresh, 60_000);
        window.addEventListener(DECLARATIONS_CHANGED, refresh);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener(DECLARATIONS_CHANGED, refresh);
        };
    }, [user?.role]);

    const nav = [
        { key: 'dashboard', label: m.nav_dashboard, icon: LayoutDashboard, href: '/admin/platform', active: pathname === '/admin/platform', badge: pending },
        { key: 'schools', label: m.nav_schools, icon: Building, href: '/admin/schools', active: false },
        { key: 'packs', label: m.nav_packs, icon: Package, href: '/admin/packs', active: false },
        { key: 'agents', label: m.nav_agents, icon: Briefcase, href: '/admin/sales-agents', active: false },
        { key: 'settings', label: m.nav_settings, icon: Settings, href: '/admin/platform/settings', active: pathname?.startsWith('/admin/platform/settings') ?? false },
    ];

    return (
        <DashboardShell lang={lang} setLang={setLang} theme={theme} toggleTheme={toggleTheme} m={m} nav={nav} userName={user?.name} avatar={user?.avatar}>
            {children}
        </DashboardShell>
    );
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireRole allowedRoles={['ADMIN', 'OWNER']}>
            <PlatformPrefsProvider>
                <Shell>{children}</Shell>
            </PlatformPrefsProvider>
        </RequireRole>
    );
}
