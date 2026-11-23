'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import type { PlatformMessages } from '@/lib/platform/messages';
import type { AgentLang } from '@/lib/agent/messages';
import { fmtDay, fmtMAD } from '@/lib/agent/format';
import { cardClass } from '@/components/dashboard/Charts';
import type { SubscriptionPeriod } from '@/lib/services/salesAgents';
import {
    confirmDeclaration,
    getDeclaration,
    getDeclarations,
    rejectDeclaration,
    type PaymentDeclaration,
} from '@/lib/services/paymentDeclarations';

interface Props {
    lang: AgentLang;
    m: PlatformMessages;
    onReviewed?: () => void; // refresh the dashboard figures and the menu badge
}

const PERIODS: SubscriptionPeriod[] = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'];
const inputClass =
    'w-full rounded-lg border border-espresso-200 bg-white px-3 py-2 text-sm text-espresso-900 focus:border-espresso-500 focus:outline-none dark:border-espresso-700 dark:bg-espresso-900 dark:text-espresso-50';
const labelClass = 'mb-1 block text-xs font-bold text-espresso-700 dark:text-espresso-200';
const errorText = (err: any) => err?.response?.data?.error || err?.message || 'Error';

// Payments declared by sales agents, waiting for the super admin (oldest first).
export default function PendingDeclarationsCard({ lang, m, onReviewed }: Props) {
    const [items, setItems] = useState<PaymentDeclaration[]>([]);
    const [open, setOpen] = useState<string | null>(null);
    const [notice, setNotice] = useState('');

    const load = useCallback(() => getDeclarations('PENDING').then(setItems).catch(() => setItems([])), []);
    useEffect(() => {
        load();
    }, [load]);

    if (items.length === 0 && !notice) return null;

    return (
        <section className={`${cardClass} p-4`} aria-label={m.sa_decl_title}>
            <h3 className="text-sm font-bold text-espresso-900 dark:text-espresso-50">
                {m.sa_decl_title}
                {items.length > 0 && <span className="ms-2 rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{items.length}</span>}
            </h3>
            <p className="mb-3 text-xs text-espresso-600 dark:text-espresso-300">{m.sa_decl_hint}</p>
            {notice && (
                <p role="status" className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                    {notice}
                </p>
            )}
            <ul className="divide-y divide-espresso-100 dark:divide-espresso-700">
                {items.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <div className="min-w-0">
                            <p className="font-semibold text-espresso-900 dark:text-espresso-50">
                                {d.school.name} · {fmtMAD(d.amount, lang)} · {m.sa_decl_periods[d.period]}
                            </p>
                            <p className="text-xs text-espresso-600 dark:text-espresso-300">
                                {m.sa_decl_methods[d.method]} · {fmtDay(d.paidAt, lang)} · {m.sa_decl_by} {d.salesAgent.name} ({d.salesAgent.code}) · {m.sa_decl_declared_on}{' '}
                                {fmtDay(d.createdAt, lang)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setNotice('');
                                setOpen(d.id);
                            }}
                            className="rounded-lg bg-espresso-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-espresso-700 dark:bg-espresso-200 dark:text-espresso-950"
                        >
                            {m.sa_decl_view}
                        </button>
                    </li>
                ))}
            </ul>
            {open && (
                <ReviewDialog
                    id={open}
                    lang={lang}
                    m={m}
                    onClose={() => setOpen(null)}
                    onDone={(message) => {
                        setOpen(null);
                        setNotice(message);
                        load();
                        onReviewed?.();
                    }}
                />
            )}
        </section>
    );
}

function ReviewDialog({ id, lang, m, onClose, onDone }: { id: string; lang: AgentLang; m: PlatformMessages; onClose: () => void; onDone: (message: string) => void }) {
    const [d, setD] = useState<PaymentDeclaration | null>(null);
    const [amount, setAmount] = useState('');
    const [period, setPeriod] = useState<SubscriptionPeriod>('MONTHLY');
    const [paidAt, setPaidAt] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getDeclaration(id)
            .then((data) => {
                setD(data);
                setAmount(String(data.amount));
                setPeriod(data.period);
                setPaidAt(data.paidAt.slice(0, 10));
            })
            .catch((err) => setError(errorText(err)));
    }, [id]);

    const run = async (action: () => Promise<unknown>, message: string) => {
        setBusy(true);
        setError('');
        try {
            await action();
            onDone(message);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    };

    const isPdf = d?.proof?.startsWith('data:application/pdf');
    // Opening a data URL in a new tab is blocked by browsers: open a blob URL instead.
    const openProof = async () => {
        if (!d?.proof) return;
        const blob = await (await fetch(d.proof)).blob();
        window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-espresso-950">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <h2 id="review-title" className="text-base font-bold text-espresso-900 dark:text-espresso-50">
                        {d ? m.sa_decl_review_title(d.school.name) : m.sa_decl_loading}
                    </h2>
                    <button type="button" onClick={onClose} aria-label={m.sa_decl_close} className="rounded-lg p-1 text-espresso-500 hover:bg-espresso-50 dark:hover:bg-espresso-900">
                        <X size={18} />
                    </button>
                </div>

                {d && (
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <span className={labelClass}>{m.sa_decl_proof}</span>
                            {isPdf ? (
                                <div className="flex flex-col items-center gap-2 rounded-xl border border-espresso-200 p-6 text-sm dark:border-espresso-700">
                                    <FileText size={36} aria-hidden="true" />
                                    <span className="font-semibold">{d.proofName ?? 'PDF'}</span>
                                </div>
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={d.proof} alt={d.proofName ?? m.sa_decl_proof} className="max-h-[420px] w-full rounded-xl border border-espresso-200 object-contain dark:border-espresso-700" />
                            )}
                            <button type="button" onClick={openProof} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-espresso-700 hover:underline dark:text-espresso-200">
                                <ExternalLink size={14} aria-hidden="true" /> {m.sa_decl_open_proof}
                            </button>
                        </div>

                        <div className="space-y-3 text-sm">
                            <dl className="grid grid-cols-2 gap-2 rounded-xl bg-espresso-50 p-3 text-xs dark:bg-espresso-900">
                                <dt className="font-bold">{m.sa_decl_agent}</dt>
                                <dd>{d.salesAgent.name} ({d.salesAgent.code})</dd>
                                <dt className="font-bold">{m.sa_decl_method}</dt>
                                <dd>{m.sa_decl_methods[d.method]}</dd>
                                <dt className="font-bold">{m.sa_decl_school_status}</dt>
                                <dd>{m.school_status[d.school.status as keyof typeof m.school_status] ?? d.school.status}</dd>
                                {d.note && (
                                    <>
                                        <dt className="font-bold">{m.sa_decl_note}</dt>
                                        <dd>{d.note}</dd>
                                    </>
                                )}
                            </dl>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass} htmlFor="rv-amount">{m.sa_decl_amount}</label>
                                    <input id="rv-amount" className={inputClass} type="number" min="1" step="0.01" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass} htmlFor="rv-period">{m.sa_decl_period}</label>
                                    <select id="rv-period" className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value as SubscriptionPeriod)}>
                                        {PERIODS.map((p) => <option key={p} value={p}>{m.sa_decl_periods[p]}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass} htmlFor="rv-date">{m.sa_decl_date}</label>
                                    <input id="rv-date" className={inputClass} type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                                </div>
                            </div>

                            {rejecting ? (
                                <div>
                                    <label className={labelClass} htmlFor="rv-reason">{m.sa_decl_reject_reason}</label>
                                    <textarea id="rv-reason" className={inputClass} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                                    <div className="mt-2 flex justify-end gap-2">
                                        <button type="button" onClick={() => setRejecting(false)} className="rounded-lg border border-espresso-200 px-3 py-2 text-xs font-semibold dark:border-espresso-700">
                                            {m.sa_decl_cancel}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy || !reason.trim()}
                                            onClick={() => run(() => rejectDeclaration(d.id, reason.trim()), m.sa_decl_rejected)}
                                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
                                        >
                                            {m.sa_decl_reject_send}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap justify-end gap-2 pt-1">
                                    <button type="button" onClick={() => setRejecting(true)} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30">
                                        {m.sa_decl_reject}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                            run(
                                                () => confirmDeclaration(d.id, { amount: Number(amount), period, paidAt }),
                                                m.sa_decl_confirmed(d.school.name)
                                            )
                                        }
                                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                        {busy ? m.sa_decl_confirming : m.sa_decl_confirm}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {error && <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
            </div>
        </div>
    );
}
