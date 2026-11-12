'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RequireRole } from '@/components/auth/RequireRole';
import { Sidebar } from '@/components/Sidebar';

import TopBar from '@/components/TopBar';
import useAuthStore, { getActiveBranchId } from '@/store/useAuthStore';

const SUPER_ADMIN_HOME = '/admin/schools';
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

    return (
        <RequireRole allowedRoles={['ADMIN', 'OWNER']}>
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
                <Sidebar currentPath={pathname} />
                <div className="flex-1 flex flex-col min-w-0">
                    <TopBar />
                    <main className="flex-1 overflow-y-auto pt-16">
                        <div className="container mx-auto p-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </RequireRole>
    );
}
