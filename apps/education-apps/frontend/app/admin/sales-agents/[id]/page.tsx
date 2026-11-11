'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import AgentReportView from '@/components/agent/AgentReportView';
import AgentRatesFields, { emptyRatesForm, ratesFormFrom, ratesPayload, type RatesForm } from '@/components/admin/AgentRatesFields';
import { apiErrorMessage, getAllPacks, type AdminPack } from '@/lib/services/packs';
import {
    deleteAgentPayout,
    todayLocal,
    getSalesAgentReport,
    recordAgentPayout,
    updateSalesAgent,
    type AgentReport,
} from '@/lib/services/salesAgents';

export default function SalesAgentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [report, setReport] = useState<AgentReport | null>(null);
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [error, setError] = useState('');
    const [edit, setEdit] = useState({ name: '', phone: '', active: true });
    const [rates, setRates] = useState<RatesForm>(emptyRatesForm);
    const [payout, setPayout] = useState({ amount: '', paidAt: todayLocal(), note: '' });
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setError('');
        try {
            const [data, allPacks] = await Promise.all([getSalesAgentReport(id), getAllPacks()]);
            setReport(data);
            setPacks(allPacks);
            setEdit({ name: data.agent.name, phone: data.agent.phone ?? '', active: data.agent.active });
            setRates(ratesFormFrom(data.agent));
        } catch (err) {
            setError(apiErrorMessage(err));
        }
    };

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') router.push('/admin');
        else if (user) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router, id]);

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const saveAgent = (e: React.FormEvent) => {
        e.preventDefault();
        run(() =>
            updateSalesAgent(
                id,
                report?.agent.isHouse
                    ? { name: edit.name, phone: edit.phone }
                    : { name: edit.name, phone: edit.phone, active: edit.active, ...ratesPayload(rates) }
            )
        );
    };

    const addPayout = (e: React.FormEvent) => {
        e.preventDefault();
        run(async () => {
            await recordAgentPayout(id, { amount: Number(payout.amount), paidAt: payout.paidAt, note: payout.note || undefined });
            setPayout({ amount: '', paidAt: todayLocal(), note: '' });
        });
    };

    const removePayout = (payoutId: string) => {
        if (!window.confirm('Supprimer ce paiement ?')) return;
        run(() => deleteAgentPayout(id, payoutId));
    };

    if (!user || user.role !== 'SUPER_ADMIN') return null;

    const inputClass = 'px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <div className="space-y-6">
            <Link href="/admin/sales-agents" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                <ArrowLeft size={16} /> Commerciaux
            </Link>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>}

            {!report && !error ? (
                <p className="text-gray-500">Chargement…</p>
            ) : !report ? null : (
                <>
                    <h1 className="text-3xl font-bold text-gray-800">
                        {report.agent.name}
                        {report.agent.isHouse && <span className="ml-3 align-middle px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">Société</span>}
                    </h1>

                    <div className="grid md:grid-cols-2 gap-4 items-start">
                        <form onSubmit={saveAgent} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                            <h2 className="font-bold text-gray-800">Fiche</h2>
                            <input className={`${inputClass} w-full`} aria-label="Nom" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
                            <input className={`${inputClass} w-full`} aria-label="Téléphone" placeholder="Téléphone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                            <div className="pt-2 border-t border-gray-100 space-y-2">
                                <div className="text-sm font-semibold text-gray-700">
                                    Taux de commission{' '}
                                    <span className="font-normal text-xs text-gray-500">— s&apos;appliquent aux prochains paiements</span>
                                </div>
                                <AgentRatesFields value={rates} onChange={setRates} packs={packs} disabled={report.agent.isHouse} />
                                {report.agent.isHouse && <p className="text-xs text-gray-500">Le code société ne touche pas de commission.</p>}
                            </div>
                            {!report.agent.isHouse && (
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
                                    Actif (un code inactif n&apos;est plus accepté à l&apos;inscription)
                                </label>
                            )}
                            <button disabled={busy} className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold disabled:opacity-50">Enregistrer</button>
                        </form>

                        {!report.agent.isHouse && (
                            <form onSubmit={addPayout} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                                <h2 className="font-bold text-gray-800">Enregistrer un versement</h2>
                                <input className={`${inputClass} w-full`} type="number" min={0.01} step="0.01" aria-label="Montant du versement (MAD)" placeholder="Montant (MAD)" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} required />
                                <input className={`${inputClass} w-full`} type="date" aria-label="Date du versement" value={payout.paidAt} onChange={(e) => setPayout({ ...payout, paidAt: e.target.value })} required />
                                <input className={`${inputClass} w-full`} aria-label="Note" placeholder="Note (ex. virement CIH)" value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} />
                                <button disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50">Enregistrer le versement</button>
                            </form>
                        )}
                    </div>

                    <AgentReportView report={report} onDeletePayout={removePayout} busy={busy} />
                </>
            )}
        </div>
    );
}
