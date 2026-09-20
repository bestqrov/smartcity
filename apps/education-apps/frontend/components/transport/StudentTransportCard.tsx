'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { TransportSubscription } from '@/types';

export default function StudentTransportCard({ studentId }: { studentId: string }) {
    const [sub, setSub] = useState<TransportSubscription | null | undefined>(undefined);
    const [error, setError] = useState('');

    useEffect(() => {
        transportService.subscriptions
            .forStudent(studentId)
            .then(setSub)
            .catch((e) => setError(transportErrorMessage(e)));
    }, [studentId]);

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Transport</h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {sub === undefined && !error && <p className="text-sm text-slate-500">Chargement…</p>}
            {sub === null && (
                <p className="text-sm text-slate-500">
                    Pas d&apos;abonnement au transport.{' '}
                    <Link href="/admin/transport" className="text-blue-600 hover:underline">
                        Abonner l&apos;élève
                    </Link>
                </p>
            )}
            {sub && (
                <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                    <p>
                        <span className="text-slate-500">Ligne : </span>
                        {sub.route?.name} {sub.status === 'PAUSED' && '(en pause)'}
                    </p>
                    <p>
                        <span className="text-slate-500">Arrêt : </span>
                        {sub.stop?.name} — matin {sub.stop?.morningTime}, soir {sub.stop?.afternoonTime}
                    </p>
                    <p>
                        <span className="text-slate-500">Tarif : </span>
                        {sub.monthlyPrice} MAD / mois
                    </p>
                    <p className={sub.paidCurrentMonth ? 'font-medium text-emerald-600' : 'font-medium text-red-600'}>
                        {sub.paidCurrentMonth ? `Mois ${sub.currentMonth} payé` : `Mois ${sub.currentMonth} non payé`}
                    </p>
                </div>
            )}
        </div>
    );
}
