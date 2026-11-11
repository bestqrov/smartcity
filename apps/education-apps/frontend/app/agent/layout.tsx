'use client';

import { useRouter } from 'next/navigation';
import { Briefcase, LogOut } from 'lucide-react';
import { RequireRole } from '@/components/auth/RequireRole';
import useAuthStore from '@/store/useAuthStore';

export default function AgentLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);

    const logout = () => {
        useAuthStore.getState().logout();
        router.push('/login');
    };

    return (
        <RequireRole allowedRoles={['SALES_AGENT']}>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white border-b border-gray-200">
                    <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 font-bold text-gray-800">
                            <Briefcase size={20} className="text-emerald-600" /> Espace commercial
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="hidden sm:inline text-gray-600">{user?.name}</span>
                            <button onClick={logout} className="flex items-center gap-1 text-gray-600 hover:text-red-600">
                                <LogOut size={16} /> Déconnexion
                            </button>
                        </div>
                    </div>
                </header>
                <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
            </div>
        </RequireRole>
    );
}
