'use client';

import { usePathname } from 'next/navigation';
import { RequireRole } from '@/components/auth/RequireRole';
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
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
                <Sidebar currentPath={pathname} role="SECRETARY" />
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
