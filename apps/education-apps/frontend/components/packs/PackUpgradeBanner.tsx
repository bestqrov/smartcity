// frontend/components/packs/PackUpgradeBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import useAuthStore from '@/store/useAuthStore';
import { getPendingUpgrades, type PendingUpgrade } from '@/lib/services/subscription';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

// Reminds ADMIN/OWNER of a pack upgrade not paid yet; red once the deadline has passed.
export default function PackUpgradeBanner() {
    const role = useAuthStore((state) => state.user?.role);
    const [upgrades, setUpgrades] = useState<PendingUpgrade[]>([]);

    useEffect(() => {
        if (role !== 'ADMIN' && role !== 'OWNER') return;
        getPendingUpgrades()
            .then(setUpgrades)
            .catch(() => setUpgrades([]));
    }, [role]);

    if (upgrades.length === 0) return null;

    return (
        <div className="mb-4 space-y-2">
            {upgrades.map((upgrade) => {
                const overdue = new Date(upgrade.dueAt).getTime() < Date.now();
                return (
                    <div
                        key={upgrade.id}
                        role={overdue ? 'alert' : 'status'}
                        className={`rounded-xl border p-3 text-sm ${
                            overdue
                                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200'
                                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                        }`}
                    >
                        Nouveau pack <strong>« {upgrade.toPackName} »</strong> ({upgrade.toMonthlyPrice} MAD / mois) :{' '}
                        {overdue ? 'le paiement était attendu avant le ' : 'paiement attendu avant le '}
                        <strong>{fmtDate(upgrade.dueAt)}</strong>.
                    </div>
                );
            })}
        </div>
    );
}
