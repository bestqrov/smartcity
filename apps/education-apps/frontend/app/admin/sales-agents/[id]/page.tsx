'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import useAuthStore from '@/store/useAuthStore';
import AgentReportView from '@/components/agent/AgentReportView';
import AgentRatesFields, { emptyRatesForm, ratesFormFrom, ratesPayload, type RatesForm } from '@/components/admin/AgentRatesFields';
import { apiErrorMessage, getAllPacks, type AdminPack } from '@/lib/services/packs';
import {
    deleteAgentPayout,
    formatRib,
    PAYOUT_METHOD_LABELS,
    WALLET_PROVIDER_LABELS,
    todayLocal,
    getSalesAgentReport,
    recordAgentPayout,
    resetAgentPassword,
    changeAgentEmail,
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
    const [emailOpen, setEmailOpen] = useState(false);
    const [emailValue, setEmailValue] = useState('');
    const [emailNotice, setEmailNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
    const [pwdOpen, setPwdOpen] = useState(false);
    const [pwd, setPwd] = useState({ next: '', confirm: '' });
    const [pwdNotice, setPwdNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

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

    const closePwd = () => {
        setPwdOpen(false);
        setPwd({ next: '', confirm: '' });
        setPwdNotice(null);
    };

    const closeEmail = () => {
        setEmailOpen(false);
        setEmailNotice(null);
    };

    const submitEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailNotice(null);
        setBusy(true);
        try {
            await changeAgentEmail(id, emailValue);
            await load();
            setEmailNotice({ type: 'ok', text: 'E-mail modifié. Le commercial doit se connecter avec la nouvelle adresse.' });
        } catch (err) {
            setEmailNotice({ type: 'error', text: apiErrorMessage(err) });
        } finally {
            setBusy(false);
        }
    };

    const submitPwd = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdNotice(null);
        if (pwd.next.length < 8) return setPwdNotice({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' });
        if (pwd.next !== pwd.confirm) return setPwdNotice({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' });
        setBusy(true);
        try {
            await resetAgentPassword(id, pwd.next);
            setPwd({ next: '', confirm: '' });
            setPwdNotice({ type: 'ok', text: 'Mot de passe modifié. Communiquez-le au commercial.' });
        } catch (err) {
            setPwdNotice({ type: 'error', text: apiErrorMessage(err) });
        } finally {
            setBusy(false);
        }
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

                    {!report.agent.isHouse && (
                        <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => { setEmailValue(report.agent.email ?? ''); setEmailOpen(true); }} className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50">
                            <Mail size={16} aria-hidden="true" /> Modifier l&apos;e-mail
                        </button>
                        <button
                            type="button"
                            onClick={() => setPwdOpen(true)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            <KeyRound size={16} aria-hidden="true" /> Réinitialiser le mot de passe
                        </button>
                        </div>
                    )}

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
                            <div className="space-y-4">
                            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1 text-sm">
                                <h2 className="font-bold text-gray-800">Mode de paiement</h2>
                                {report.agent.payoutMethod ? (
                                    <>
                                        <div className="font-semibold text-gray-800">
                                            {report.agent.payoutMethod === 'MOBILE_MONEY' && report.agent.walletProvider
                                                ? WALLET_PROVIDER_LABELS[report.agent.walletProvider]
                                                : PAYOUT_METHOD_LABELS[report.agent.payoutMethod]}
                                        </div>
                                        {report.agent.accountHolder && <div className="text-gray-700">Titulaire : {report.agent.accountHolder}</div>}
                                        {report.agent.bankName && <div className="text-gray-700">Banque : {report.agent.bankName}</div>}
                                        {report.agent.rib && <div className="text-gray-700">RIB : <span className="font-mono">{formatRib(report.agent.rib)}</span></div>}
                                        {report.agent.payoutPhone && <div className="text-gray-700">Téléphone : {report.agent.payoutPhone}</div>}
                                    </>
                                ) : (
                                    <p className="text-gray-500">Non renseigné par le commercial</p>
                                )}
                            </div>
                            <form onSubmit={addPayout} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                                <h2 className="font-bold text-gray-800">Enregistrer un versement</h2>
                                <input className={`${inputClass} w-full`} type="number" min={0.01} step="0.01" aria-label="Montant du versement (MAD)" placeholder="Montant (MAD)" value={payout.amount} onChange={(e) => setPayout({ ...payout, amount: e.target.value })} required />
                                <input className={`${inputClass} w-full`} type="date" aria-label="Date du versement" value={payout.paidAt} onChange={(e) => setPayout({ ...payout, paidAt: e.target.value })} required />
                                <input className={`${inputClass} w-full`} aria-label="Note" placeholder="Note (ex. virement CIH)" value={payout.note} onChange={(e) => setPayout({ ...payout, note: e.target.value })} />
                                <button disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50">Enregistrer le versement</button>
                            </form>
                            </div>
                        )}
                    </div>

                    <Modal isOpen={emailOpen} onClose={closeEmail} title="Modifier l'e-mail" size="sm">
                        <form onSubmit={submitEmail} className="space-y-3">
                            <input className={`${inputClass} w-full`} type="email" autoComplete="off" aria-label="E-mail de connexion" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} required />
                            {emailNotice && (
                                <div role={emailNotice.type === 'error' ? 'alert' : 'status'} className={`p-3 rounded-lg text-sm border ${emailNotice.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                    {emailNotice.text}
                                </div>
                            )}
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={closeEmail} className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700">Fermer</button>
                                <button disabled={busy} className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold disabled:opacity-50">Enregistrer</button>
                            </div>
                        </form>
                    </Modal>

                    <Modal isOpen={pwdOpen} onClose={closePwd} title="Réinitialiser le mot de passe" size="sm">
                        <form onSubmit={submitPwd} className="space-y-3">
                            <input className={`${inputClass} w-full`} type="password" autoComplete="new-password" aria-label="Nouveau mot de passe" placeholder="Nouveau mot de passe (8 caractères min.)" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required />
                            <input className={`${inputClass} w-full`} type="password" autoComplete="new-password" aria-label="Confirmer le mot de passe" placeholder="Confirmer le mot de passe" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
                            {pwdNotice && (
                                <div role={pwdNotice.type === 'error' ? 'alert' : 'status'} className={`p-3 rounded-lg text-sm border ${pwdNotice.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                    {pwdNotice.text}
                                </div>
                            )}
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={closePwd} className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700">Fermer</button>
                                <button disabled={busy} className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold disabled:opacity-50">Modifier</button>
                            </div>
                        </form>
                    </Modal>

                    <AgentReportView report={report} onDeletePayout={removePayout} busy={busy} />
                </>
            )}
        </div>
    );
}
