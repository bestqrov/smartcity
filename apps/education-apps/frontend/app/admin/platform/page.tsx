'use client';

import { useEffect, useState } from 'react';
import { DashboardBanner } from '@/components/dashboard/DashboardShell';
import PendingDeclarationsCard from '@/components/platform/PendingDeclarationsCard';
import PendingUpgradesCard from '@/components/platform/PendingUpgradesCard';
import PlatformDashboard from '@/components/platform/PlatformDashboard';
import { apiErrorMessage } from '@/lib/services/packs';
import { getPlatformOverview, type PlatformOverview } from '@/lib/services/platform';
import { usePlatformPrefs } from '@/lib/platform/prefs';
import { localizeApiError } from '@/lib/agent/messages';
import { DECLARATIONS_CHANGED } from '@/lib/services/paymentDeclarations';

export default function PlatformPage() {
    const { lang, m } = usePlatformPrefs();
    const [data, setData] = useState<PlatformOverview | null>(null);
    const [error, setError] = useState('');

    const load = () =>
        getPlatformOverview()
            .then(setData)
            .catch((err) => setError(apiErrorMessage(err)));
    useEffect(() => {
        load();
    }, []);

    if (error)
        return (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200">
                {localizeApiError(m, error)}
            </div>
        );
    if (!data)
        return (
            <p role="status" className="text-espresso-700 dark:text-espresso-200">
                {m.loading}
            </p>
        );

    return (
        <div className="space-y-4">
            <DashboardBanner title={m.banner_title} subtitle={m.banner_sub(data.schools.length, data.agents.length)} />
            <PendingDeclarationsCard
                lang={lang}
                m={m}
                onReviewed={() => {
                    load(); // the confirmed payment changes the revenue, commissions and school statuses
                    window.dispatchEvent(new Event(DECLARATIONS_CHANGED));
                }}
            />
            <PendingUpgradesCard upgrades={data.pendingUpgrades ?? []} lang={lang} m={m} />
            <PlatformDashboard data={data} lang={lang} m={m} />
        </div>
    );
}
