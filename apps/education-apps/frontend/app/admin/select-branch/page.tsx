'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBranches, Branch } from '@/lib/services/branches';
import useAuthStore, { setActiveBranchId } from '@/store/useAuthStore';

export default function SelectBranchPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (user && user.role !== 'OWNER') {
            router.push('/admin');
            return;
        }
        getBranches()
            .then((data) => {
                setBranches(data);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, [user, router]);

    const handleSelect = (branchId: string) => {
        setActiveBranchId(branchId);
        router.push('/admin');
    };

    if (loading) return <div className="p-6">Chargement…</div>;
    if (error) return <div className="p-6 text-red-600">Impossible de charger les établissements.</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="mx-auto max-w-md space-y-4">
                <h1 className="text-xl font-semibold text-slate-900">Choisissez un établissement</h1>
                {branches.length === 0 && (
                    <p className="text-slate-500">Aucun établissement trouvé pour votre école.</p>
                )}
                <div className="space-y-2">
                    {branches.map((branch) => (
                        <button
                            key={branch.id}
                            onClick={() => handleSelect(branch.id)}
                            className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-indigo-400 hover:bg-indigo-50"
                        >
                            <p className="font-medium text-slate-900">{branch.name}</p>
                            <p className="text-sm text-slate-500">{branch.city}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
