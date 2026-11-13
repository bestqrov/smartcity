'use client';

import { usePathname } from 'next/navigation';
import { RequireRole } from '@/components/auth/RequireRole';
import PackUpgradeHost from '@/components/packs/PackUpgradeHost';
import { Sidebar } from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

export default function SecretaryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <RequireRole allowedRoles={['SECRETARY']}>
            <PackUpgradeHost />
            <div className="vib-shell flex h-screen h-[100dvh] transition-colors duration-300 lg:p-4 lg:gap-4">
                <Sidebar currentPath={pathname} role="SECRETARY" />
                <div className="flex-1 flex flex-col min-w-0">
                    <TopBar />
                    <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pt-16 lg:pt-20">
                        <div className="container mx-auto p-4 sm:p-6 lg:px-4 lg:py-2">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </RequireRole>
    );
}
