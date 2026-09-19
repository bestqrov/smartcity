'use client';

import { useEffect, useState } from 'react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import { getStudents } from '@/lib/services/students';
import type { Student, TransportRoute, TransportSubscription, TransportSubscriptionStatus } from '@/types';
import { cardCls, errorCls, inputCls, labelCls, primaryBtnCls, smallBtnCls } from './styles';

const STATUS_LABELS: Record<TransportSubscriptionStatus, string> = {
    ACTIVE: 'Actif',
    PAUSED: 'En pause',
    ENDED: 'Terminé',
};

const currentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export default function SubscriptionsTab() {
    const [subs, setSubs] = useState<TransportSubscription[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [filter, setFilter] = useState<TransportSubscriptionStatus | ''>('ACTIVE');
    const [error, setError] = useState('');
    const [studentId, setStudentId] = useState('');
    const [routeId, setRouteId] = useState('');
    const [stopId, setStopId] = useState('');
    const [payingId, setPayingId] = useState<string | null>(null);
    const [payMonth, setPayMonth] = useState(currentMonth());
    const [payMethod, setPayMethod] = useState('Espèces');
    const [paying, setPaying] = useState(false);

    const load = async () => {
        try {
            const [s, st, r] = await Promise.all([
                transportService.subscriptions.list(filter || undefined),
                getStudents(),
                transportService.routes.list(),
            ]);
            setSubs(s);
            setStudents(st);
            setRoutes(r);
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const run = async (action: () => Promise<unknown>) => {
        setError('');
        try {
            await action();
            await load();
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    const selectedRoute = routes.find((r) => r.id === routeId);

    return (
        <div className="space-y-6">
            {error && <p className={errorCls}>{error}</p>}

            <div className={cardCls}>
                <h2 className="font-bold text-gray-800 mb-4">Nouvel abonnement</h2>
                <form
                    className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                            await transportService.subscriptions.create({ studentId, routeId, stopId });
                            setStudentId('');
                            setStopId('');
                        });
                    }}
                >
                    <div>
                        <label className={labelCls}>Élève</label>
                        <select className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                            <option value="">—</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name} {s.surname}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Ligne</label>
                        <select
                            className={inputCls}
                            value={routeId}
                            onChange={(e) => {
                                setRouteId(e.target.value);
                                setStopId('');
                            }}
                            required
                        >
                            <option value="">—</option>
                            {routes.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Arrêt</label>
                        <select className={inputCls} value={stopId} onChange={(e) => setStopId(e.target.value)} required>
                            <option value="">—</option>
                            {(selectedRoute?.stops ?? []).map((stop) => (
                                <option key={stop.id} value={stop.id}>
                                    {stop.order}. {stop.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className={primaryBtnCls}>
                        Abonner
                    </button>
                </form>
            </div>

            <div className={cardCls}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-800">Abonnements</h2>
                    <select
                        className={`${inputCls} w-40`}
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as TransportSubscriptionStatus | '')}
                    >
                        <option value="">Tous</option>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                {subs.length === 0 && <p className="text-sm text-gray-400">Aucun abonnement.</p>}
                <div className="space-y-3">
                    {subs.map((sub) => (
                        <div key={sub.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        {sub.student?.name} {sub.student?.surname}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {sub.route?.name} · {sub.stop?.name} · {sub.monthlyPrice} MAD/mois ·{' '}
                                        {STATUS_LABELS[sub.status]}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {sub.status === 'ACTIVE' && (
                                        <>
                                            <button className={smallBtnCls} onClick={() => setPayingId(payingId === sub.id ? null : sub.id)}>
                                                Encaisser
                                            </button>
                                            <button className={smallBtnCls} onClick={() => run(() => transportService.subscriptions.pause(sub.id))}>
                                                Pause
                                            </button>
                                        </>
                                    )}
                                    {sub.status === 'PAUSED' && (
                                        <button className={smallBtnCls} onClick={() => run(() => transportService.subscriptions.resume(sub.id))}>
                                            Reprendre
                                        </button>
                                    )}
                                    {sub.status !== 'ENDED' && (
                                        <button
                                            className={`${smallBtnCls} text-red-600`}
                                            onClick={() => {
                                                if (window.confirm('Terminer cet abonnement ?')) {
                                                    run(() => transportService.subscriptions.end(sub.id));
                                                }
                                            }}
                                        >
                                            Terminer
                                        </button>
                                    )}
                                </div>
                            </div>

                            {payingId === sub.id && (
                                <form
                                    className="grid grid-cols-3 gap-2 items-end mt-3"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (paying) return;
                                        setPaying(true);
                                        run(async () => {
                                            await transportService.subscriptions.pay(sub.id, { forMonth: payMonth, method: payMethod });
                                            setPayingId(null);
                                        }).finally(() => setPaying(false));
                                    }}
                                >
                                    <div>
                                        <label className={labelCls}>Mois</label>
                                        <input type="month" className={inputCls} value={payMonth} onChange={(e) => setPayMonth(e.target.value)} required />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Mode</label>
                                        <select className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                                            <option>Espèces</option>
                                            <option>Virement</option>
                                            <option>Chèque</option>
                                        </select>
                                    </div>
                                    <button type="submit" disabled={paying} className={primaryBtnCls}>
                                        {paying ? 'Enregistrement…' : `Valider ${sub.monthlyPrice} MAD`}
                                    </button>
                                </form>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
