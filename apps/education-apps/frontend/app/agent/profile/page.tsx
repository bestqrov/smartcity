'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, KeyRound, Wallet, Contact } from 'lucide-react';
import { apiErrorMessage } from '@/lib/services/packs';
import {
    changeMyPassword,
    getMyAgentReport,
    PAYOUT_METHOD_LABELS,
    WALLET_PROVIDER_LABELS,
    updateMyProfile,
    type AgentReport,
    type PayoutMethod,
    type WalletProvider,
} from '@/lib/services/salesAgents';
import { useAgentPrefs } from '@/lib/agent/prefs';
import { localizeApiError } from '@/lib/agent/messages';

type Notice = { type: 'ok' | 'error'; text: string } | null;

const inputClass =
    'w-full rounded-lg border border-espresso-100 bg-white px-3 py-2 text-espresso-950 placeholder:text-gray-400 focus:border-espresso-500 focus:outline-none focus:ring-2 focus:ring-espresso-300 dark:border-espresso-700 dark:bg-espresso-950 dark:text-espresso-50 dark:placeholder:text-espresso-400 dark:focus:ring-espresso-600';
const labelClass = 'block text-sm font-semibold text-espresso-800 dark:text-espresso-100';
const cardClass = 'rounded-xl border border-espresso-100 bg-white p-4 shadow-sm dark:border-espresso-800 dark:bg-espresso-900 dark:shadow-none sm:p-5';
const sectionTitle = 'flex items-center gap-2 font-bold text-espresso-900 dark:text-espresso-50';
const METHODS = Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[];

function NoticeBox({ notice }: { notice: Notice }) {
    if (!notice) return null;
    const ok = notice.type === 'ok';
    return (
        <div
            role={ok ? 'status' : 'alert'}
            className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                ok
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-200'
                    : 'border-red-100 bg-red-50 text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200'
            }`}
        >
            {ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
            {notice.text}
        </div>
    );
}

export default function AgentProfilePage() {
    const { m } = useAgentPrefs();
    const [agent, setAgent] = useState<AgentReport['agent'] | null>(null);
    const [loadError, setLoadError] = useState('');
    const [form, setForm] = useState({ phone: '', method: '' as PayoutMethod | '', bankName: '', rib: '', accountHolder: '', payoutPhone: '', walletProvider: '' as WalletProvider | '' });
    // Notices keep a key (not text) so they follow a language switch.
    const [profileNotice, setProfileNotice] = useState<{ type: 'ok' | 'error'; raw: string } | null>(null);
    const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
    const [pwdNotice, setPwdNotice] = useState<{ type: 'ok' | 'error'; raw: string } | null>(null);
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
                    walletProvider: agent.walletProvider ?? '',
                });
            })
            .catch((err) => setLoadError(apiErrorMessage(err)));
    }, []);

    const LOCAL: Record<string, string> = {
        '@saved': m.profile_saved,
        '@pwd_changed': m.pwd_changed,
        '@pwd_mismatch': m.pwd_mismatch,
    };
    const toNotice = (n: { type: 'ok' | 'error'; raw: string } | null): Notice => (n ? { type: n.type, text: LOCAL[n.raw] ?? localizeApiError(m, n.raw) } : null);

    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileNotice(null);
        setBusy(true);
        try {
            await updateMyProfile({
                phone: form.phone,
                payoutMethod: form.method || null,
                ...(form.method === 'BANK_TRANSFER' && { bankName: form.bankName, rib: form.rib, accountHolder: form.accountHolder }),
                ...(form.method === 'MOBILE_MONEY' && {
                    walletProvider: form.walletProvider as WalletProvider,
                    accountHolder: form.accountHolder,
                    payoutPhone: form.payoutPhone,
                }),
                ...(form.method === 'MONEY_TRANSFER' && { accountHolder: form.accountHolder, payoutPhone: form.payoutPhone }),
            });
            setProfileNotice({ type: 'ok', raw: '@saved' });
        } catch (err) {
            setProfileNotice({ type: 'error', raw: apiErrorMessage(err) });
        } finally {
            setBusy(false);
        }
    };

    const savePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwdNotice(null);
        if (pwd.next !== pwd.confirm) {
            setPwdNotice({ type: 'error', raw: '@pwd_mismatch' });
            return;
        }
        setBusy(true);
        try {
            await changeMyPassword({ currentPassword: pwd.current, newPassword: pwd.next });
            setPwd({ current: '', next: '', confirm: '' });
            setPwdNotice({ type: 'ok', raw: '@pwd_changed' });
        } catch (err) {
            setPwdNotice({ type: 'error', raw: apiErrorMessage(err) });
        } finally {
            setBusy(false);
        }
    };

    if (loadError)
        return (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200">
                {localizeApiError(m, loadError)}
            </div>
        );
    if (!agent)
        return (
            <p role="status" className="text-espresso-700 dark:text-espresso-200">
                {m.loading}
            </p>
        );

    const field = (key: 'bankName' | 'accountHolder' | 'payoutPhone', label: string, placeholder = label, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <label className={labelClass}>
            {label}
            <input className={`${inputClass} mt-1`} placeholder={placeholder} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required {...extra} />
        </label>
    );
    const submitClass =
        'w-full rounded-lg px-4 py-2.5 font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-espresso-400 disabled:opacity-50 dark:focus-visible:ring-offset-espresso-900 sm:w-auto';

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <header className="flex justify-center">
                <div className="w-full rounded-2xl bg-espresso-800 px-5 py-3 text-center text-white shadow-sm dark:bg-espresso-ink sm:rounded-full">
                    <h1 className="text-lg font-extrabold sm:text-2xl">{m.profile_title}</h1>
                </div>
            </header>

            <form onSubmit={saveProfile} className={`${cardClass} space-y-5`}>
                <section className="space-y-3">
                    <h2 className={sectionTitle}>
                        <Contact size={18} aria-hidden="true" /> {m.section_identity}
                    </h2>
                    <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
                        <dt className="text-gray-500 dark:text-espresso-300">{m.name}</dt>
                        <dd className="font-medium text-espresso-950 dark:text-espresso-50">{agent.name}</dd>
                        <dt className="text-gray-500 dark:text-espresso-300">{m.email}</dt>
                        <dd className="break-all font-medium text-espresso-950 dark:text-espresso-50" dir="ltr">
                            {agent.email ?? '—'}
                        </dd>
                        <dt className="text-gray-500 dark:text-espresso-300">{m.code}</dt>
                        <dd className="font-mono font-medium text-espresso-950 dark:text-espresso-50">{agent.code}</dd>
                    </dl>
                    <p className="text-xs text-gray-500 dark:text-espresso-300">{m.contact_admin}</p>
                    <label className={labelClass}>
                        {m.phone}
                        <input className={`${inputClass} mt-1`} type="tel" dir="ltr" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </label>
                </section>

                <section className="space-y-3 border-t border-espresso-100 pt-4 dark:border-espresso-800">
                    <h2 className={sectionTitle}>
                        <Wallet size={18} aria-hidden="true" /> {m.section_payout}
                    </h2>
                    <fieldset className="space-y-2">
                        <legend className="mb-2 text-sm font-semibold text-espresso-800 dark:text-espresso-100">{m.payout_legend}</legend>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {METHODS.map((method) => {
                                const checked = form.method === method;
                                return (
                                    <label
                                        key={method}
                                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm focus-within:ring-2 focus-within:ring-espresso-400 ${
                                            checked
                                                ? 'border-espresso-600 bg-espresso-50 font-semibold text-espresso-900 dark:border-espresso-300 dark:bg-espresso-800 dark:text-espresso-50'
                                                : 'border-espresso-100 text-espresso-800 hover:bg-espresso-50 dark:border-espresso-700 dark:text-espresso-100 dark:hover:bg-espresso-800/60'
                                        }`}
                                    >
                                        <input type="radio" name="payoutMethod" className="accent-espresso-700 dark:accent-espresso-300" checked={checked} onChange={() => setForm({ ...form, method })} />
                                        {m.payout_method[method]}
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    {form.method === 'BANK_TRANSFER' && (
                        <div className="space-y-3">
                            {field('bankName', m.bank, m.bank_placeholder)}
                            {field('accountHolder', m.account_holder)}
                            <div>
                                <label className={labelClass}>
                                    {m.rib}
                                    <input
                                        className={`${inputClass} mt-1 font-mono`}
                                        dir="ltr"
                                        inputMode="numeric"
                                        placeholder="RIB"
                                        value={form.rib}
                                        onChange={(e) => setForm({ ...form, rib: e.target.value })}
                                        required
                                    />
                                </label>
                                <p className="mt-1 text-xs text-gray-500 dark:text-espresso-300">{m.rib_hint}</p>
                            </div>
                        </div>
                    )}
                    {form.method === 'MONEY_TRANSFER' && (
                        <div className="space-y-3">
                            {field('accountHolder', m.beneficiary_name)}
                            {field('payoutPhone', m.beneficiary_phone, m.beneficiary_phone, { type: 'tel', dir: 'ltr' })}
                        </div>
                    )}
                    {form.method === 'MOBILE_MONEY' && (
                        <div className="space-y-3">
                            <label className={labelClass}>
                                {m.operator}
                                <select
                                    className={`${inputClass} mt-1`}
                                    value={form.walletProvider}
                                    onChange={(e) => setForm({ ...form, walletProvider: e.target.value as WalletProvider })}
                                    required
                                >
                                    <option value="">{m.choose_operator}</option>
                                    {(Object.keys(WALLET_PROVIDER_LABELS) as WalletProvider[]).map((provider) => (
                                        <option key={provider} value={provider}>
                                            {WALLET_PROVIDER_LABELS[provider]}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {field('accountHolder', m.wallet_holder)}
                            {field('payoutPhone', m.wallet_phone, m.wallet_phone, { type: 'tel', dir: 'ltr' })}
                        </div>
                    )}
                    {form.method === 'CASH' && <p className="text-xs text-gray-500 dark:text-espresso-300">{m.cash_note}</p>}
                </section>

                <NoticeBox notice={toNotice(profileNotice)} />
                <button disabled={busy} className={`${submitClass} bg-espresso-800 hover:bg-espresso-700 dark:bg-espresso-200 dark:text-espresso-950 dark:hover:bg-espresso-100`}>
                    {m.save}
                </button>
            </form>

            <form onSubmit={savePassword} className={`${cardClass} space-y-3`}>
                <h2 className={sectionTitle}>
                    <KeyRound size={18} aria-hidden="true" /> {m.pwd_title}
                </h2>
                <label className={labelClass}>
                    {m.pwd_current}
                    <input className={`${inputClass} mt-1`} type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
                </label>
                <label className={labelClass}>
                    {m.pwd_new}
                    <input
                        className={`${inputClass} mt-1`}
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        placeholder={m.pwd_new_placeholder}
                        value={pwd.next}
                        onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                        required
                    />
                </label>
                <label className={labelClass}>
                    {m.pwd_confirm}
                    <input className={`${inputClass} mt-1`} type="password" autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
                </label>
                <NoticeBox notice={toNotice(pwdNotice)} />
                <button disabled={busy} className={`${submitClass} bg-charcoal hover:bg-black dark:bg-espresso-600 dark:hover:bg-espresso-500`}>
                    {m.pwd_submit}
                </button>
            </form>
        </div>
    );
}
