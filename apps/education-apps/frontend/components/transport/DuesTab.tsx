'use client';

import { useEffect, useState } from 'react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { TransportSubscription } from '@/types';
import { cardCls, errorCls, inputCls, labelCls } from './styles';

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function DuesTab() {
    const [month, setMonth] = useState(currentMonth());
    const [dues, setDues] = useState<TransportSubscription[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        setError('');
        transportService
            .dues(month)
            .then(setDues)
            .catch((e) => setError(transportErrorMessage(e)));
    }, [month]);

    const total = dues.reduce((sum, sub) => sum + sub.monthlyPrice, 0);

    return (
        <div className={cardCls}>
            <div className="flex items-end justify-between mb-4">
                <div>
                    <h2 className="font-bold text-gray-800">Impayés du mois</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {dues.length} élève{dues.length > 1 ? 's' : ''} · {total} MAD à encaisser
                    </p>
                </div>
                <div>
                    <label className={labelCls}>Mois</label>
                    <input type="month" className={inputCls} value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
            </div>
            {error && <p className={`${errorCls} mb-3`}>{error}</p>}
            {dues.length === 0 && !error && <p className="text-sm text-gray-400">Tout est réglé pour ce mois. 🎉</p>}
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
                        <span className="font-semibold text-red-600">{sub.monthlyPrice} MAD</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
