'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getAccessToken } from '@/store/useAuthStore';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { UserRole } from '@/types';

interface RequireRoleProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

export function RequireRole({ children, allowedRoles }: RequireRoleProps) {
    const router = useRouter();
    const { user, isLoading, isAuthenticated } = useAuth();
    const [hydrated, setHydrated] = useState(false);
    useEffect(() => setHydrated(true), []);

    // After a page reload the token is restored from localStorage but the user is only known once
    // /auth/me answers — until then we are still loading, not logged out (a failed /auth/me clears
    // the token itself). `hydrated` keeps the first client render identical to the server one.
    const waiting = !hydrated || isLoading || (!!getAccessToken() && !user);

    useEffect(() => {
        if (!waiting) {
            if (!isAuthenticated) {
                router.push('/login');
            } else if (user && !allowedRoles.includes(user.role) && user.role !== 'SUPER_ADMIN') {
                // Redirect to appropriate dashboard
                if (user.role === 'ADMIN') {
                    router.push('/admin');
                } else if (user.role === 'SECRETARY') {
                    router.push('/secretary');
                } else if (user.role === 'OWNER') {
                    router.push('/admin/select-branch');
                }
            }
        }
    }, [user, waiting, isAuthenticated, allowedRoles, router]);

    if (waiting) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (!isAuthenticated || !user || (!allowedRoles.includes(user.role) && user.role !== 'SUPER_ADMIN')) {
        return null;
    }

    return <>{children}</>;
}
