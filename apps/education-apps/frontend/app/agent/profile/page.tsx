'use client';

import { useEffect, useState } from 'react';
import { apiErrorMessage } from '@/lib/services/packs';
import {
    changeMyPassword,
    getMyAgentReport,
    PAYOUT_METHOD_LABELS,
    updateMyProfile,
    type AgentReport,
    type PayoutMethod,
} from '@/lib/services/salesAgents';

type Notice = { type: 'ok' | 'error'; text: string } | null;

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg';
const METHODS = Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[];

function NoticeBox({ notice }: { notice: Notice }) {
    if (!notice) return null;
    return (
        <div
            role={notice.type === 'error' ? 'alert' : 'status'}
            className={`p-3 rounded-lg text-sm border ${notice.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}
        >
            {notice.text}
        </div>
    );
}

export default function AgentProfilePage() {
    const [agent, setAgent] = useState<AgentReport['agent'] | null>(null);
    const [loadError, setLoadError] = useState('');
    const [form, setForm] = useState({ phone: '', method: '' as PayoutMethod | '', bankName: '', rib: '', accountHolder: '', payoutPhone: '' });
    const [profileNotice, setProfileNotice] = useState<Notice>(null);
    const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
    const [pwdNotice, setPwdNotice] = useState<Notice>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getMyAgentReport()
            .then(({ agent }) => {
                setAgent(agent);
                setForm({
                    phone: agent.phone ?? '',
                    method: agent.payoutMethod ?? '',
                    bankName: agent.bankName ?? '',
                    rib: agent.rib ?? '',
                    accountHolder: agent.accountHolder ?? '',
                    payoutPhone: agent.payoutPhone ?? '',
                });
            })
            .catch((err) => setLoadError(apiErrorMessage(err)));
    }, []);

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileNotice(null);
        setBusy(true);
        try {
            await updateMyProfile({
                phone: form.phone,
                payoutMethod: form.method || null,
                ...(form.method === 'BANK_TRANSFER' && { bankName: form.bankName, rib: form.rib, accountHolder: form.accountHolder }),
                ...(form.method === 'MONEY_TRANSFER' && { accountHolder: form.accountHolder, payoutPhone: form.payoutPhone }),
            });
            setProfileNotice({ type: 'ok', text: 'Profil enregistré.' });
        } catch (err) {
            setProfileNotice({ type: 'error', text: apiErrorMessage(err) });
        } finally {
            setBusy(false);
        }
    };

    const savePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdNotice(null);
        if (pwd.next !== pwd.confirm) {
            setPwdNotice({ type: 'error', text: 'Les deux nouveaux mots de passe ne correspondent pas.' });
            return;
        }
        setBusy(true);
        try {
            await changeMyPassword({ currentPassword: pwd.current, newPassword: pwd.next });
            setPwd({ current: '', next: '', confirm: '' });
            setPwdNotice({ type: 'ok', text: 'Mot de passe modifié.' });
        } catch (err) {
            setPwdNotice({ type: 'error', text: apiErrorMessage(err) });
        } finally {
            setBusy(false);
        }
    };

    if (loadError) return <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{loadError}</div>;
    if (!agent) return <p className="text-gray-500">Chargement…</p>;

    return (
        <div className="space-y-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-gray-800">Mon profil</h1>

            <form onSubmit={saveProfile} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
                <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-gray-500">Nom</dt>
                    <dd className="font-medium text-gray-800">{agent.name}</dd>
                    <dt className="text-gray-500">E-mail</dt>
                    <dd className="font-medium text-gray-800 break-all">{agent.email ?? '—'}</dd>
                    <dt className="text-gray-500">Code</dt>
                    <dd className="font-mono font-medium text-gray-800">{agent.code}</dd>
                </dl>
                <p className="text-xs text-gray-500">Pour changer votre nom ou e-mail, contactez l&apos;administrateur.</p>

                <label className="block text-sm text-gray-700">
                    Téléphone
                    <input className={`${inputClass} mt-1`} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-semibold text-gray-700">Mode de paiement de vos commissions</legend>
                    {METHODS.map((method) => (
                        <label key={method} className="flex items-center gap-2 text-sm text-gray-700">
                            <input type="radio" name="payoutMethod" checked={form.method === method} onChange={() => setForm({ ...form, method })} />
                            {PAYOUT_METHOD_LABELS[method]}
                        </label>
                    ))}
                </fieldset>

                {form.method === 'BANK_TRANSFER' && (
                    <div className="space-y-3">
                        <input className={inputClass} aria-label="Banque" placeholder="Banque (ex. CIH)" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required />
                        <input className={inputClass} aria-label="Titulaire du compte" placeholder="Titulaire du compte" value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} required />
                        <div>
                            <input className={`${inputClass} font-mono`} aria-label="RIB" placeholder="RIB" inputMode="numeric" value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} required />
                            <p className="text-xs text-gray-500 mt-1">Le RIB comporte 24 chiffres (les espaces sont ignorés).</p>
                        </div>
                    </div>
                )}
                {form.method === 'MONEY_TRANSFER' && (
                    <div className="space-y-3">
                        <input className={inputClass} aria-label="Nom du bénéficiaire" placeholder="Nom du bénéficiaire" value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} required />
                        <input className={inputClass} aria-label="Téléphone du bénéficiaire" placeholder="Téléphone du bénéficiaire" value={form.payoutPhone} onChange={(e) => setForm({ ...form, payoutPhone: e.target.value })} required />
                    </div>
                )}
                {form.method === 'CASH' && <p className="text-xs text-gray-500">Vos commissions vous seront remises en espèces.</p>}

                <NoticeBox notice={profileNotice} />
                <button disabled={busy} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold disabled:opacity-50">Enregistrer</button>
            </form>

            <form onSubmit={savePassword} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <h2 className="font-bold text-gray-800">Changer le mot de passe</h2>
                <input className={inputClass} type="password" autoComplete="current-password" aria-label="Mot de passe actuel" placeholder="Mot de passe actuel" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
                <input className={inputClass} type="password" autoComplete="new-password" minLength={8} aria-label="Nouveau mot de passe" placeholder="Nouveau mot de passe (8 caractères min.)" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required />
                <input className={inputClass} type="password" autoComplete="new-password" aria-label="Confirmer le nouveau mot de passe" placeholder="Confirmer le nouveau mot de passe" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
                <NoticeBox notice={pwdNotice} />
                <button disabled={busy} className="px-4 py-2 bg-gray-800 text-white rounded-lg font-semibold disabled:opacity-50">Modifier le mot de passe</button>
            </form>
        </div>
    );
}
