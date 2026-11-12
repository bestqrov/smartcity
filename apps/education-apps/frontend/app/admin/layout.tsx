'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RequireRole } from '@/components/auth/RequireRole';
import PackUpgradeBanner from '@/components/packs/PackUpgradeBanner';
import PackUpgradeHost from '@/components/packs/PackUpgradeHost';
import { Sidebar } from '@/components/Sidebar';

import TopBar from '@/components/TopBar';
import useAuthStore, { getActiveBranchId } from '@/store/useAuthStore';

const SUPER_ADMIN_HOME = '/admin/platform';
const SUPER_ADMIN_PAGES = ['/admin/schools', '/admin/packs', '/admin/sales-agents', '/admin/platform'];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        if (user?.role === 'OWNER' && !getActiveBranchId() && pathname !== '/admin/select-branch') {
            router.push('/admin/select-branch');
        }
        // The super admin manages the platform, not a school: school pages (branch-scoped) don't apply.
        if (user?.role === 'SUPER_ADMIN' && !SUPER_ADMIN_PAGES.some((page) => pathname?.startsWith(page))) {
            router.replace(SUPER_ADMIN_HOME);
        }
    }, [user, pathname, router]);

    // The platform dashboard brings its own espresso shell (sidebar, toggles, credit).
    if (pathname?.startsWith('/admin/platform')) {
        return <RequireRole allowedRoles={['ADMIN', 'OWNER']}>{children}</RequireRole>;
    }

    return (
        <RequireRole allowedRoles={['ADMIN', 'OWNER']}>
            <PackUpgradeHost />
            <div className="flex h-screen h-[100dvh] bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
                <Sidebar currentPath={pathname} />
                <div className="flex-1 flex flex-col min-w-0">
                    <TopBar />
                    <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pt-16">
                        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                            {pathname === '/admin' && <PackUpgradeBanner />}
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </RequireRole>
    );
}
