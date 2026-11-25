'use client';

// «Mon abonnement» on the school admin dashboard (ADMIN / OWNER): current pack, its options and limits, the trial
// or status, a pack change (bigger = immediate, smaller = request to the super admin) and requests with replies.
import { useCallback, useEffect, useState } from 'react';
import { CreditCard, MessageSquarePlus, Package } from 'lucide-react';
import PackUpgradeDialog from '@/components/packs/PackUpgradeDialog';
import { PACK_FEATURES } from '@/lib/packs';
import { appLocale, useI18n } from '@/lib/i18n/I18nProvider';
import { apiErrorMessage } from '@/lib/services/packs';
import { getSchoolCapacity, type SchoolCapacity } from '@/lib/services/subscription';
import {
    FORM_KINDS,
    createSchoolRequest,
    getMySchoolRequests,
    type MySchoolRequest,
    type SchoolRequestKind,
    type SchoolRequestStatus,
} from '@/lib/services/schoolRequests';

interface Props {
    trialEndsAt?: string | null;
    features?: string[] | null;
    onChanged?: () => void; // refresh the school profile after a pack change
}

const KIND_LABELS: Record<SchoolRequestKind, string> = {
    PACK_DOWNGRADE: 'Pack inférieur',
    FEATURE: 'Nouvelle fonctionnalité',
    PACK_OPTION: 'Option du pack',
    PROBLEM: 'Problème',
    OTHER: 'Autre',
};
const STATUS_LABELS: Record<SchoolRequestStatus, string> = { NEW: 'Envoyée', IN_PROGRESS: 'En cours', DONE: 'Traitée', REJECTED: 'Refusée' };
const STATUS_TONES: Record<SchoolRequestStatus, string> = {
    NEW: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    DONE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
};
const SCHOOL_STATUS: Record<SchoolCapacity['status'], string> = { PENDING: "Période d'essai", ACTIVE: 'Actif', SUSPENDED: 'Suspendu' };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
const featureLabel = (key: string) => PACK_FEATURES.find((feature) => feature.key === key)?.label ?? key;
const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white';

export default function SubscriptionCard({ trialEndsAt, features, onChanged }: Props) {
    const { tr } = useI18n();
    const [capacity, setCapacity] = useState<SchoolCapacity | null>(null);
    const [requests, setRequests] = useState<MySchoolRequest[]>([]);
    const [browsing, setBrowsing] = useState(false);
    const [asking, setAsking] = useState(false);
    const [kind, setKind] = useState<SchoolRequestKind>('FEATURE');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const load = useCallback(() => {
        getSchoolCapacity().then(setCapacity).catch(() => setCapacity(null));
        getMySchoolRequests().then(setRequests).catch(() => setRequests([]));
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    const send = async () => {
        setSending(true);
        setError('');
        try {
            await createSchoolRequest({ kind, message: message.trim() });
            setMessage('');
            setAsking(false);
            setNotice(tr('Demande envoyée'));
            load();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSending(false);
        }
    };

    const trialOver = capacity?.status === 'PENDING' && trialEndsAt && new Date(trialEndsAt) < new Date();

    return (
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5" aria-labelledby="subscription-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 id="subscription-title" className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                    <CreditCard size={20} aria-hidden="true" />
                    {tr('Mon abonnement')}
                </h2>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setBrowsing(true)} disabled={!capacity} className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                        <Package size={16} aria-hidden="true" />
                        {tr('Changer de pack')}
                    </button>
                    <button type="button" onClick={() => { setNotice(''); setAsking((v) => !v); }} aria-expanded={asking} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10">
                        <MessageSquarePlus size={16} aria-hidden="true" />
                        {tr('Demander une fonctionnalité')}
                    </button>
                </div>
            </div>

            {capacity && (
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                        <dt className="text-gray-500 dark:text-gray-400">{tr('Pack')}</dt>
                        <dd className="font-semibold text-gray-900 dark:text-white">{capacity.packName ?? tr('Aucun pack')}</dd>
                    </div>
                    <div>
                        <dt className="text-gray-500 dark:text-gray-400">{tr('Élèves')}</dt>
                        <dd className="font-semibold text-gray-900 dark:text-white">
                            <bdi dir="ltr">{capacity.limit === null ? capacity.current : `${capacity.current} / ${capacity.limit}`}</bdi>
                            {capacity.limit === null && <> ({tr('illimité')})</>}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-gray-500 dark:text-gray-400">{tr('Statut')}</dt>
                        <dd className={`font-semibold ${trialOver || capacity.status === 'SUSPENDED' ? 'text-red-600 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>
                            {tr(SCHOOL_STATUS[capacity.status])}
                            {capacity.status === 'PENDING' && trialEndsAt && (
                                <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                                    {trialOver ? tr('Essai terminé le {date}', { date: fmtDate(trialEndsAt) }) : tr("Jusqu'au {date}", { date: fmtDate(trialEndsAt) })}
                                </span>
                            )}
                        </dd>
                    </div>
                    <div className="sm:col-span-3">
                        <dt className="text-gray-500 dark:text-gray-400">{tr('Établissements')}</dt>
                        <dd className="font-semibold text-gray-900 dark:text-white">
                            <bdi dir="ltr">{capacity.branches.limit === null ? capacity.branches.current : `${capacity.branches.current} / ${capacity.branches.limit}`}</bdi>
                        </dd>
                    </div>
                    {features && features.length > 0 && (
                        <div className="sm:col-span-3">
                            <dt className="text-gray-500 dark:text-gray-400">{tr('Options du pack')}</dt>
                            <dd className="mt-1 flex flex-wrap gap-1.5">
                                {features.map((f) => (
                                    <span key={f} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-200">{tr(featureLabel(f))}</span>
                                ))}
                            </dd>
                        </div>
                    )}
                </dl>
            )}

            {notice && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">{notice}</p>}

            {asking && (
                <div className="mt-4 space-y-3 rounded-2xl bg-gray-50 p-4 dark:bg-white/5">
                    <div>
                        <label htmlFor="req-kind" className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">{tr('Type')}</label>
                        <select id="req-kind" value={kind} onChange={(e) => setKind(e.target.value as SchoolRequestKind)} className={inputClass}>
                            {FORM_KINDS.map((k) => <option key={k} value={k}>{tr(KIND_LABELS[k])}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="req-message" className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200">{tr('Message')}</label>
                        <textarea id="req-message" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
                    </div>
                    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{tr(error)}</p>}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setAsking(false)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 dark:border-white/10 dark:text-gray-200">{tr('Annuler')}</button>
                        <button type="button" onClick={send} disabled={sending || !message.trim()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                            {sending ? tr('Envoi…') : tr('Envoyer')}
                        </button>
                    </div>
                </div>
            )}

            {requests.length > 0 && (
                <div className="mt-4">
                    <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-white">{tr('Mes demandes')}</h3>
                    <ul className="divide-y divide-gray-100 dark:divide-white/10">
                        {requests.map((r) => (
                            <li key={r.id} className="py-2 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {tr(KIND_LABELS[r.kind])}
                                        {r.targetPackName && <> · {r.targetPackName}</>}
                                    </span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONES[r.status]}`}>{tr(STATUS_LABELS[r.status])}</span>
                                    <span className="ms-auto text-xs text-gray-500 dark:text-gray-400">{fmtDate(r.createdAt)}</span>
                                </div>
                                {r.message && <p className="mt-1 whitespace-pre-line text-gray-600 dark:text-gray-300">{r.message}</p>}
                                {r.reply && (
                                    <p className="mt-1 whitespace-pre-line rounded-lg border-s-4 border-indigo-400 bg-indigo-50 px-3 py-1.5 text-gray-800 dark:bg-indigo-900/30 dark:text-gray-100">
                                        <strong>{tr('Réponse :')}</strong> {r.reply}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {browsing && (
                <PackUpgradeDialog
                    onDone={(changed) => {
                        setBrowsing(false);
                        if (changed) {
                            load();
                            onChanged?.();
                        }
                    }}
                />
            )}
        </section>
    );
}
