'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { apiErrorMessage } from '@/lib/services/packs';
import {
    deleteSchoolPayment,
    formatDate,
    formatMAD,
    getSchoolPayments,
    recordSchoolPayment,
    type SchoolPaymentItem,
    type SubscriptionPeriod,
} from '@/lib/services/salesAgents';

interface Props {
    school: { id: string; name: string } | null;
    onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function SchoolPaymentsModal({ school, onClose }: Props) {
    const [payments, setPayments] = useState<SchoolPaymentItem[]>([]);
    const [form, setForm] = useState({ amount: '', period: 'MONTHLY' as SubscriptionPeriod, paidAt: today(), note: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async (schoolId: string) => {
        setError('');
        try {
            setPayments(await getSchoolPayments(schoolId));
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    useEffect(() => {
        if (school) load(school.id);
        else setPayments([]);
    }, [school]);

    if (!school) return null;

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
            setForm({ amount: '', period: form.period, paidAt: today(), note: '' });
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

    const inputClass = 'px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <Modal isOpen onClose={onClose} title={`Paiements — ${school.name}`} size="lg">
            <div className="space-y-4">
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

                <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input className={inputClass} type="number" min={0.01} step="0.01" placeholder="Montant (MAD)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    <select className={inputClass} value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value as SubscriptionPeriod })}>
                        <option value="MONTHLY">Mensuel</option>
                        <option value="YEARLY">Annuel</option>
                    </select>
                    <input className={inputClass} type="date" value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} required />
                    <input className={inputClass} placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                    <button disabled={busy} className="sm:col-span-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50">
                        Enregistrer le paiement
                    </button>
                </form>

                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                        <tr>
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Montant</th>
                            <th className="px-3 py-2">Commercial</th>
                            <th className="px-3 py-2">Commission</th>
                            <th className="px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map((p) => (
                            <tr key={p.id} className="border-t border-gray-100">
                                <td className="px-3 py-2">{formatDate(p.paidAt)}</td>
                                <td className="px-3 py-2">
                                    {formatMAD(p.amount)} <span className="text-xs text-gray-500">({p.period === 'YEARLY' ? 'annuel' : 'mensuel'})</span>
                                </td>
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
                            <tr><td colSpan={5} className="px-3 py-4 text-gray-500">Aucun paiement enregistré.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
}
