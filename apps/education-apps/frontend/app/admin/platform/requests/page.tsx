'use client';

// «Demandes des écoles»: requests sent by school admins (smaller pack, feature, problem...). The super admin sets
// the status and writes a reply, which the school reads in its «Mon abonnement» card.
import { useCallback, useEffect, useState } from 'react';
import { DashboardBanner } from '@/components/dashboard/DashboardShell';
import { usePlatformPrefs } from '@/lib/platform/prefs';
import { fmtDay } from '@/lib/agent/format';
import type { AgentLang } from '@/lib/agent/messages';
import type { PlatformMessages } from '@/lib/platform/messages';
import { apiErrorMessage } from '@/lib/services/packs';
import {
    REQUEST_STATUSES,
    SCHOOL_REQUESTS_CHANGED,
    getSchoolRequests,
    updateSchoolRequest,
    type SchoolRequest,
    type SchoolRequestStatus,
} from '@/lib/services/schoolRequests';

const cardClass = 'rounded-2xl border border-espresso-100 bg-white p-4 shadow-sm dark:border-espresso-800 dark:bg-espresso-900';
const inputClass =
    'w-full rounded-xl border border-espresso-100 bg-white px-3 py-2 text-sm text-gray-900 focus:border-espresso-500 focus:outline-none dark:border-espresso-700 dark:bg-espresso-950 dark:text-espresso-50';
const TONES: Record<SchoolRequestStatus, string> = {
    NEW: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
    IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    DONE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    REJECTED: 'bg-gray-200 text-gray-700 dark:bg-espresso-800 dark:text-espresso-200',
};

export default function SchoolRequestsPage() {
    const { m, lang } = usePlatformPrefs();
    const [filter, setFilter] = useState<SchoolRequestStatus | ''>('NEW');
    const [items, setItems] = useState<SchoolRequest[] | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(() => {
        setError('');
        getSchoolRequests(filter || undefined)
            .then(setItems)
            .catch((err) => {
                setItems([]);
                setError(apiErrorMessage(err));
            });
    }, [filter]);
    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="space-y-4">
            <DashboardBanner title={m.rq_title} subtitle={m.rq_sub} />
            <div className="flex flex-wrap gap-2" role="group" aria-label={m.rq_status}>
                {(['', ...REQUEST_STATUSES] as const).map((s) => (
                    <button
                        key={s || 'all'}
                        type="button"
                        aria-pressed={filter === s}
                        onClick={() => setFilter(s)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                            filter === s
                                ? 'border-espresso-700 bg-espresso-800 text-white dark:bg-espresso-200 dark:text-espresso-950'
                                : 'border-espresso-200 bg-white text-espresso-800 dark:border-espresso-700 dark:bg-espresso-900 dark:text-espresso-100'
                        }`}
                    >
                        {s ? m.rq_statuses[s] : m.rq_all}
                    </button>
                ))}
            </div>
            {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
            {items === null ? (
                <p role="status" className="text-sm text-espresso-600 dark:text-espresso-300">{m.rq_loading}</p>
            ) : items.length === 0 ? (
                <p className={`${cardClass} text-sm text-espresso-600 dark:text-espresso-300`}>{m.rq_empty}</p>
            ) : (
                <ul className="space-y-3">
                    {items.map((r) => (
                        <RequestItem key={r.id} item={r} lang={lang} m={m} onSaved={load} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function RequestItem({ item, lang, m, onSaved }: { item: SchoolRequest; lang: AgentLang; m: PlatformMessages; onSaved: () => void }) {
    const [status, setStatus] = useState<SchoolRequestStatus>(item.status);
    const [reply, setReply] = useState(item.reply ?? '');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const dirty = status !== item.status || reply.trim() !== (item.reply ?? '');

    const save = async () => {
        setBusy(true);
        setErr('');
        try {
            await updateSchoolRequest(item.id, { status, reply: reply.trim() });
            window.dispatchEvent(new Event(SCHOOL_REQUESTS_CHANGED));
            onSaved();
        } catch (e) {
            setErr(apiErrorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <li className={cardClass}>
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-espresso-900 dark:text-espresso-50">{item.school.name}</span>
                {item.school.city && <span className="text-xs text-espresso-600 dark:text-espresso-300">{item.school.city}</span>}
                <span className="rounded-full bg-espresso-50 px-2 py-0.5 text-xs font-semibold text-espresso-800 dark:bg-espresso-800 dark:text-espresso-100">{m.rq_kinds[item.kind]}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[item.status]}`}>{m.rq_statuses[item.status]}</span>
                <span className="ms-auto text-xs text-espresso-600 dark:text-espresso-300">{fmtDay(item.createdAt, lang)}</span>
            </div>
            <p className="mt-1 text-xs text-espresso-600 dark:text-espresso-300">
                {m.rq_owner}: {item.school.ownerName}
                {item.school.ownerPhone && <> · <bdi dir="ltr">{item.school.ownerPhone}</bdi></>}
                {' · '}{m.rq_current}: {item.school.pack?.name ?? '—'}
                {item.targetPackName && <> · {m.rq_target}: <strong>{item.targetPackName}</strong></>}
            </p>
            {item.message && <p className="mt-2 whitespace-pre-line text-sm text-espresso-900 dark:text-espresso-50">{item.message}</p>}
            <div className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <div>
                    <label htmlFor={`st-${item.id}`} className="mb-1 block text-xs font-bold text-espresso-700 dark:text-espresso-200">{m.rq_status}</label>
                    <select id={`st-${item.id}`} className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as SchoolRequestStatus)}>
                        {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{m.rq_statuses[s]}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor={`rp-${item.id}`} className="mb-1 block text-xs font-bold text-espresso-700 dark:text-espresso-200">{m.rq_reply}</label>
                    <textarea id={`rp-${item.id}`} rows={2} maxLength={2000} className={inputClass} value={reply} onChange={(e) => setReply(e.target.value)} />
                </div>
                <button type="button" onClick={save} disabled={busy || !dirty} className="rounded-xl bg-espresso-800 px-4 py-2 text-sm font-bold text-white hover:bg-espresso-700 disabled:opacity-50 dark:bg-espresso-200 dark:text-espresso-950">
                    {busy ? m.rq_saving : m.rq_save}
                </button>
            </div>
            {err && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>}
        </li>
    );
}
