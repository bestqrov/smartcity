'use client';

import { useState } from 'react';
import { Bus } from 'lucide-react';
import FleetTab from '@/components/transport/FleetTab';
import RoutesTab from '@/components/transport/RoutesTab';
import SubscriptionsTab from '@/components/transport/SubscriptionsTab';
import DuesTab from '@/components/transport/DuesTab';
import PricingModePanel from '@/components/transport/PricingModePanel';

const TABS = [
    { id: 'routes', label: 'Lignes & arrêts' },
    { id: 'fleet', label: 'Véhicules & chauffeurs' },
    { id: 'subscriptions', label: 'Abonnements' },
    { id: 'dues', label: 'Impayés' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function TransportPage() {
    const [tab, setTab] = useState<TabId>('routes');

    return (
        <div className="p-0 lg:p-6 space-y-6">
            <div className="flex justify-between items-center gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Transport scolaire</h1>
                    <p className="text-gray-600 mt-1">Lignes, véhicules, abonnements et paiements mensuels</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100">
                    <Bus className="text-blue-600" size={24} />
                </div>
            </div>

            <div className="flex gap-1 sm:gap-2 border-b border-gray-200 overflow-x-auto">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
                            tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'routes' && (
                <div className="space-y-6">
                    <PricingModePanel />
                    <RoutesTab />
                </div>
            )}
            {tab === 'fleet' && <FleetTab />}
            {tab === 'subscriptions' && <SubscriptionsTab />}
            {tab === 'dues' && <DuesTab />}
        </div>
    );
}
