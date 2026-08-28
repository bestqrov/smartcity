'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { UserRole } from '@/types';

interface RequireRoleProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
}

export function RequireRole({ children, allowedRoles }: RequireRoleProps) {
    const router = useRouter();
    const { user, isLoading, isAuthenticated } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            if (!isAuthenticated) {
                router.push('/login');
            } else if (user && !allowedRoles.includes(user.role) && user.role !== 'SUPER_ADMIN') {
                // Redirect to appropriate dashboard
                if (user.role === 'ADMIN') {
                    router.push('/admin');
                } else if (user.role === 'SECRETARY') {
                    router.push('/secretary');
                }
            }
        }
    }, [user, isLoading, isAuthenticated, allowedRoles, router]);

    if (isLoading) {
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
