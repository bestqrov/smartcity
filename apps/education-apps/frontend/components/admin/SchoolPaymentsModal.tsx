'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { apiErrorMessage } from '@/lib/services/packs';
import {
    deleteSchoolPayment,
    formatDay,
    formatMAD,
    getSchoolPayments,
    recordSchoolPayment,
    todayLocal,
    type SchoolPaymentItem,
    type SubscriptionPeriod,
} from '@/lib/services/salesAgents';
import { PERIODS, PERIOD_LABELS } from '@/lib/salesAgentLabels';

interface Props {
    school: { id: string; name: string; offerPeriod?: SubscriptionPeriod | null; offerPrice?: number | null };
    onClose: () => void;
}

export default function SchoolPaymentsModal({ school, onClose }: Props) {
    const [payments, setPayments] = useState<SchoolPaymentItem[]>([]);
    const [form, setForm] = useState({ amount: school.offerPrice != null ? String(school.offerPrice) : '', period: (school.offerPeriod ?? 'MONTHLY') as SubscriptionPeriod, paidAt: todayLocal(), note: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = async (schoolId: string) => {
        setError('');
        try {
            setPayments(await getSchoolPayments(schoolId));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(school.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [school.id]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            await recordSchoolPayment(school.id, {
                amount: Number(form.amount),
                period: form.period,
                paidAt: form.paidAt,
                note: form.note || undefined,
            });
            setForm({ amount: school.offerPrice != null ? String(school.offerPrice) : '', period: form.period, paidAt: todayLocal(), note: '' });
            await load(school.id);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const remove = async (paymentId: string) => {
        if (!window.confirm('Supprimer ce paiement ? Sa commission sera annulée.')) return;
        setBusy(true);
        try {
            await deleteSchoolPayment(school.id, paymentId);
            await load(school.id);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const inputClass = 'min-h-10 px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <Modal isOpen onClose={onClose} title={`Paiements — ${school.name}`} size="lg">
            <div className="space-y-4">
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

                <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input className={inputClass} type="number" min={0.01} step="0.01" aria-label="Montant (MAD)" placeholder="Montant (MAD)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    <select className={inputClass} aria-label="Période" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value as SubscriptionPeriod })}>
                        {PERIODS.map((period) => (
                            <option key={period} value={period}>
                                {PERIOD_LABELS[period]}
                            </option>
                        ))}
                    </select>
                    <input className={inputClass} type="date" aria-label="Date du paiement" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} required />
                    <input className={inputClass} aria-label="Note" placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                    <button disabled={busy} className="sm:col-span-4 min-h-10 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50">
                        Enregistrer le paiement
                    </button>
                </form>

                <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Montant</th>
                            <th className="px-3 py-2">Pack</th>
                            <th className="px-3 py-2">Commercial</th>
                            <th className="px-3 py-2">Commission</th>
                            <th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map((p) => (
                            <tr key={p.id} className="border-t border-gray-100">
                                <td className="px-3 py-2">{formatDay(p.paidAt)}</td>
                                <td className="px-3 py-2">
                                    {formatMAD(p.amount)} <span className="text-xs text-gray-500">({PERIOD_LABELS[p.period].toLowerCase()})</span>
                                </td>
                                <td className="px-3 py-2">{p.packName ?? '—'}</td>
                                <td className="px-3 py-2">{p.salesAgent ? `${p.salesAgent.name} (${p.salesAgent.code})` : '—'}</td>
                                <td className="px-3 py-2">{formatMAD(p.commissionAmount)} <span className="text-xs text-gray-500">({p.commissionRate} %)</span></td>
                                <td className="px-3 py-2 text-right">
                                    <button onClick={() => remove(p.id)} disabled={busy} className="text-red-600 hover:text-red-800" aria-label="Supprimer">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {payments.length === 0 && (
                            <tr><td colSpan={6} className="px-3 py-4 text-gray-500">{loading ? 'Chargement…' : 'Aucun paiement enregistré.'}</td></tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </Modal>
    );
}
