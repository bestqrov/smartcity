'use client';

import { useMemo, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import type { AgentMessages } from '@/lib/agent/messages';
import { localizeApiError } from '@/lib/agent/messages';
import type { RateTableRow, SubscriptionPeriod } from '@/lib/services/salesAgents';
import { DECLARATION_METHODS, declarePayment, fileToProof, type DeclarationMethod } from '@/lib/services/paymentDeclarations';

interface Props {
    school: { id: string; name: string; packName: string | null };
    rateTable: RateTableRow[];
    m: AgentMessages;
    onClose: () => void;
    onDone: () => void;
}

const PERIODS: SubscriptionPeriod[] = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'];
const today = () => new Date().toISOString().slice(0, 10);
const MAX_FILE = 5 * 1024 * 1024;
const inputClass =
    'w-full rounded-lg border border-espresso-200 bg-white px-3 py-2 text-sm text-espresso-900 focus:border-espresso-500 focus:outline-none dark:border-espresso-700 dark:bg-espresso-900 dark:text-espresso-50';
const labelClass = 'mb-1 block text-xs font-bold text-espresso-700 dark:text-espresso-200';

// The agent reports a client's payment with its proof; the super admin validates it.
export default function DeclarePaymentModal({ school, rateTable, m, onClose, onDone }: Props) {
    const pack = useMemo(() => rateTable.find((row) => row.packName === school.packName) ?? null, [rateTable, school.packName]);
    const priceFor = (period: SubscriptionPeriod) => {
        if (!pack?.monthlyPrice) return '';
        if (period === 'MONTHLY') return String(pack.monthlyPrice);
        if (period === 'SEMIANNUAL') return String(pack.monthlyPrice * 6);
        return String(pack.yearlyPrice ?? pack.monthlyPrice * 12);
    };

    const [period, setPeriod] = useState<SubscriptionPeriod>('MONTHLY');
    const [amount, setAmount] = useState(priceFor('MONTHLY'));
    const [paidAt, setPaidAt] = useState(today());
    const [method, setMethod] = useState<DeclarationMethod>('BANK_TRANSFER');
    const [note, setNote] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    const choosePeriod = (next: SubscriptionPeriod) => {
        // Follow the pack price while the agent has not typed another amount.
        if (amount === priceFor(period)) setAmount(priceFor(next));
        setPeriod(next);
    };

    const chooseFile = (chosen: File | undefined) => {
        setError(null);
        if (!chosen) return;
        if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(chosen.type)) {
            setError(localizeApiError(m, 'The proof must be an image (JPG, PNG, WEBP) or a PDF'));
            return;
        }
        if (chosen.size > MAX_FILE && chosen.type === 'application/pdf') {
            setError(localizeApiError(m, 'The proof is too large (5 MB max)'));
            return;
        }
        setFile(chosen);
        setPreview(chosen.type.startsWith('image/') ? URL.createObjectURL(chosen) : null);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError(m.decl_proof_missing);
            return;
        }
        setSending(true);
        setError(null);
        try {
            const proof = await fileToProof(file);
            await declarePayment({ schoolId: school.id, amount: Number(amount), period, paidAt, method, note: note.trim() || undefined, proof, proofName: file.name });
            onDone();
        } catch (err: any) {
            setError(localizeApiError(m, err?.response?.data?.error || err?.message || m.generic_error));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="decl-title">
            <form onSubmit={submit} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-espresso-950">
                <div className="mb-3 flex items-start justify-between gap-3">
                    <h2 id="decl-title" className="text-base font-bold text-espresso-900 dark:text-espresso-50">{m.decl_title(school.name)}</h2>
                    <button type="button" onClick={onClose} aria-label={m.close} className="rounded-lg p-1 text-espresso-500 hover:bg-espresso-50 dark:hover:bg-espresso-900">
                        <X size={18} />
                    </button>
                </div>
                <p className="mb-4 rounded-lg bg-espresso-50 p-3 text-xs text-espresso-700 dark:bg-espresso-900 dark:text-espresso-200">{m.decl_intro}</p>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelClass} htmlFor="decl-period">{m.decl_period}</label>
                        <select id="decl-period" className={inputClass} value={period} onChange={(e) => choosePeriod(e.target.value as SubscriptionPeriod)}>
                            {PERIODS.map((p) => <option key={p} value={p}>{m.period[p]}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass} htmlFor="decl-amount">{m.decl_amount}</label>
                        <input id="decl-amount" className={inputClass} type="number" min="1" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
                    </div>
                    <div>
                        <label className={labelClass} htmlFor="decl-date">{m.decl_date}</label>
                        <input id="decl-date" className={inputClass} type="date" required max={today()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass} htmlFor="decl-method">{m.decl_method}</label>
                        <select id="decl-method" className={inputClass} value={method} onChange={(e) => setMethod(e.target.value as DeclarationMethod)}>
                            {DECLARATION_METHODS.map((value) => <option key={value} value={value}>{m.decl_methods[value]}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mt-3">
                    <label className={labelClass} htmlFor="decl-note">{m.decl_note}</label>
                    <input id="decl-note" className={inputClass} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={m.decl_note_placeholder} />
                </div>

                <div className="mt-3">
                    <span className={labelClass}>{m.decl_proof}</span>
                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-espresso-200 p-4 text-center text-sm text-espresso-600 hover:border-espresso-400 dark:border-espresso-700 dark:text-espresso-300">
                        {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt="" className="max-h-40 rounded-lg object-contain" />
                        ) : file ? (
                            <FileText size={28} aria-hidden="true" />
                        ) : (
                            <Upload size={28} aria-hidden="true" />
                        )}
                        <span className="font-semibold">{file ? file.name : m.decl_proof}</span>
                        <span className="text-xs">{m.decl_proof_hint}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => chooseFile(e.target.files?.[0])} />
                    </label>
                </div>

                {error && <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-lg border border-espresso-200 px-4 py-2 text-sm font-semibold text-espresso-700 hover:bg-espresso-50 dark:border-espresso-700 dark:text-espresso-200 dark:hover:bg-espresso-900">
                        {m.cancel}
                    </button>
                    <button type="submit" disabled={sending} className="rounded-lg bg-espresso-800 px-4 py-2 text-sm font-bold text-white hover:bg-espresso-700 disabled:opacity-60 dark:bg-espresso-200 dark:text-espresso-950">
                        {sending ? m.decl_sending : m.decl_submit}
                    </button>
                </div>
            </form>
        </div>
    );
}
