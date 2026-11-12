'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, CreditCard, LayoutDashboard, Percent, Receipt, UserCircle, Users } from 'lucide-react';
import { RequireRole } from '@/components/auth/RequireRole';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import useAuthStore, { getActiveBranchId } from '@/store/useAuthStore';
import { AgentPrefsProvider, useAgentPrefs, type AgentSection } from '@/lib/agent/prefs';
import type { AgentMessages } from '@/lib/agent/messages';

type NavItem = { key: AgentSection | 'profile'; label: (m: AgentMessages) => string; icon: typeof Users };
const NAV: NavItem[] = [
    { key: 'overview', label: (m) => m.nav_overview, icon: LayoutDashboard },
    { key: 'clients', label: (m) => m.nav_clients, icon: Users },
    { key: 'commissions', label: (m) => m.nav_commissions, icon: Receipt },
    { key: 'payouts', label: (m) => m.nav_payouts, icon: CreditCard },
    { key: 'rates', label: (m) => m.nav_rates, icon: Percent },
    { key: 'profile', label: (m) => m.nav_profile, icon: UserCircle },
];

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

    // School accounts (owner/admin/secretary) may enter only when linked to a sales agent profile.
    const allowed = !!user && user.role !== 'SUPER_ADMIN' && (user.role === 'SALES_AGENT' || !!user.salesAgent);
    const schoolHome =
        user?.role === 'OWNER' ? (getActiveBranchId() ? '/admin' : '/admin/select-branch') : user?.role === 'SECRETARY' ? '/secretary' : '/admin';
    useEffect(() => {
        if (!user) return;
        if (user.role === 'SUPER_ADMIN') router.replace('/admin/sales-agents');
        else if (!allowed) router.replace(schoolHome);
    }, [user, allowed, schoolHome, router]);

    const nav = NAV.map((item) => {
        const key = item.key;
        return {
            key,
            label: item.label(m),
            icon: item.icon,
            href: key === 'profile' ? '/agent/profile' : key === 'overview' ? '/agent' : `/agent#${key}`,
            active: key === 'profile' ? !!onProfile : !onProfile && section.id === key,
            onClick: key === 'profile' ? undefined : () => goToSection(key),
        };
    });

    return (
        <DashboardShell lang={lang} setLang={setLang} theme={theme} toggleTheme={toggleTheme} m={m} nav={nav} userName={user?.name} avatar={user?.avatar} extraLink={user && user.role !== 'SALES_AGENT' ? { label: m.my_school, href: schoolHome, icon: Building2 } : undefined}>
            {allowed ? children : null}
        </DashboardShell>
    );
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
    return (
        <RequireRole allowedRoles={['SALES_AGENT', 'OWNER', 'ADMIN', 'SECRETARY']}>
            <AgentPrefsProvider>
                <Shell>{children}</Shell>
            </AgentPrefsProvider>
        </RequireRole>
    );
}
