'use client';

import { useEffect, useState } from 'react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { TransportSubscription } from '@/types';
import { cardCls, errorCls, inputCls, labelCls } from './styles';

import { useI18n } from '@/lib/i18n/I18nProvider';
const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function DuesTab() {
    const { tr } = useI18n();
    const [month, setMonth] = useState('');
    const [dues, setDues] = useState<TransportSubscription[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setMonth(currentMonth());
    }, []);

    useEffect(() => {
        if (!month) return;
        setError('');
        setLoading(true);
        transportService
            .dues(month)
            .then(setDues)
            .catch((e) => {
                setDues([]);
                setError(transportErrorMessage(e));
            })
            .finally(() => setLoading(false));
    }, [month]);

    const total = dues.reduce((sum, sub) => sum + sub.monthlyPrice, 0);

    return (
        <div className={cardCls}>
            <div className="flex items-end justify-between mb-4">
                <div>
                    <h2 className="font-bold text-gray-800">{tr("Impayés du mois")}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {dues.length}{' '}{tr("élève")}{dues.length > 1 ? 's' : ''} · {total}{tr("MAD à encaisser")}</p>
                </div>
                <div>
                    <label className={labelCls}>{tr("Mois")}</label>
                    <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
            </div>
            {error && <p className={`${errorCls} mb-3`}>{tr(error)}</p>}
            {loading && <p className="text-sm text-gray-400">{tr("Chargement…")}</p>}
            {!loading && dues.length === 0 && !error && (
                <p className="text-sm text-gray-400">{tr("Tout est réglé pour ce mois. 🎉")}</p>
            )}
            <div className="space-y-2">
                {dues.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm">
                        <span>
                            <span className="font-semibold">
                                {sub.student?.name} {sub.student?.surname}
                            </span>{' '}
                            <span className="text-gray-500">
                                · {sub.route?.name} · {sub.stop?.name}
                            </span>
                        </span>
                        <span className="font-semibold text-red-600">{sub.monthlyPrice}{' '}{tr("MAD")}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
