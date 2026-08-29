'use client';

import { useEffect, useState } from 'react';
import { getBranchSummary, BranchSummary } from '@/lib/services/branches';
import { setActiveBranchId } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';

export default function BranchesSummaryPage() {
    const router = useRouter();
    const [summary, setSummary] = useState<BranchSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        getBranchSummary()
            .then((data) => {
                setSummary(data);
                setLoading(false);
            })
            .catch(() => {
                setError(true);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-6">Chargement…</div>;
    if (error) return <div className="p-6 text-red-600">Impossible de charger le résumé des établissements.</div>;
    if (!summary) return <div className="p-6">Aucune donnée</div>;

    const handleOpenBranch = (branchId: string) => {
        setActiveBranchId(branchId);
        router.push('/admin');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    Vue d'ensemble — tous les établissements
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {summary.totalStudents} élèves au total — solde dû combiné: {summary.totalBalanceDue} MAD
                </p>
            </div>

            {summary.branches.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400">Aucun établissement pour le moment.</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {summary.branches.map(({ branch, studentCount, presentToday, balanceDue }) => (
                    <button
                        key={branch.id}
                        onClick={() => handleOpenBranch(branch.id)}
                        className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-5 text-left transition-colors hover:border-blue-400 dark:hover:border-blue-500"
                    >
                        <p className="font-semibold text-slate-900 dark:text-white">{branch.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{branch.city}</p>
                        <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            <p>Élèves: {studentCount}</p>
                            <p>Présents aujourd'hui: {presentToday}</p>
                            <p>Solde dû: {balanceDue} MAD</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
