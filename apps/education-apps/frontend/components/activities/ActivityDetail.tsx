'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, BellRing, Download, Loader2 } from 'lucide-react';
import { activitiesService, type ActivityResponseRow, type ActivityWithCounts } from '@/lib/services/activities';
import { apiErrorMessage } from '@/lib/services/grades';
import { fmtDateTime } from './utils';

const ANSWER: Record<'YES' | 'NO' | 'NONE', { label: string; cls: string }> = {
    YES: { label: 'Oui', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    NO: { label: 'Non', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
    NONE: { label: 'Sans réponse', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

interface Props {
    activity: ActivityWithCounts;
    onBack: () => void;
    onCountsChange: () => void;
}

export default function ActivityDetail({ activity, onBack, onCountsChange }: Props) {
    const [rows, setRows] = useState<ActivityResponseRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    useEffect(() => {
        activitiesService
            .responses(activity.id)
            .then(setRows)
            .catch((e) => setError(apiErrorMessage(e)));
    }, [activity.id]);

    const togglePaid = async (r: ActivityResponseRow) => {
        setBusy(r.studentId);
        try {
            await activitiesService.setPaid(activity.id, r.studentId, !r.paid);
            setRows((p) => p?.map((x) => (x.studentId === r.studentId ? { ...x, paid: !r.paid } : x)) ?? p);
            onCountsChange();
        } catch (e) {
            window.alert(apiErrorMessage(e));
        } finally {
            setBusy(null);
        }
    };

    const remind = async () => {
        setBusy('remind');
        try {
            const { parents } = await activitiesService.remind(activity.id);
            window.alert(parents ? `Relance envoyée à ${parents} parent(s).` : 'Aucun parent à relancer.');
        } catch (e) {
            window.alert(apiErrorMessage(e));
        } finally {
            setBusy(null);
        }
    };

    const exportXlsx = async () => {
        if (!rows) return;
        const XLSX = await import('xlsx');
        const data = rows.map((r) => ({
            Nom: r.surname,
            Prénom: r.name,
            Parent: r.parentName ?? '',
            Téléphone: r.parentPhone ?? '',
            Réponse: r.answer === 'YES' ? 'Oui' : r.answer === 'NO' ? 'Non' : '',
            Payé: r.paid ? 'Oui' : 'Non',
            Note: r.note ?? '',
            'Répondu le': r.answeredAt ? fmtDateTime(r.answeredAt) : '',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Réponses');
        XLSX.writeFile(wb, `${activity.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || 'activite'}.xlsx`);
    };

    const showPaid = (activity.price ?? 0) > 0;

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2">
                <button type="button" onClick={onBack} aria-label="Retour" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                    <ArrowLeft size={20} className="rtl:rotate-180" />
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{activity.title}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {fmtDateTime(activity.startAt)}
                        {activity.location ? ` · ${activity.location}` : ''}
                    </p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {activity.published && activity.needsConsent && (
                    <button
                        type="button"
                        onClick={remind}
                        disabled={busy === 'remind'}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        {busy === 'remind' ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} Relancer les sans réponse
                    </button>
                )}
                <button
                    type="button"
                    onClick={exportXlsx}
                    disabled={!rows?.length}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                    <Download size={16} /> Exporter Excel
                </button>
            </div>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
            {!rows && !error && <Loader2 className="mx-auto animate-spin text-slate-400" />}
            {rows && rows.length === 0 && <p className="text-center text-sm text-slate-500">Aucun élève concerné.</p>}
            {rows && rows.length > 0 && (
                <>
                    {/* Phones: cards */}
                    <ul className="space-y-2 md:hidden">
                        {rows.map((r) => {
                            const a = ANSWER[r.answer ?? 'NONE'];
                            return (
                                <li key={r.studentId} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="min-w-0 truncate font-medium text-slate-900 dark:text-white">
                                            {r.name} {r.surname}
                                        </p>
                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${a.cls}`}>{a.label}</span>
                                    </div>
                                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                        {r.parentName ?? '—'} · <bdi dir="ltr">{r.parentPhone ?? ''}</bdi>
                                    </p>
                                    {r.note && <p className="mt-1 text-xs italic text-slate-500">{r.note}</p>}
                                    {showPaid && (
                                        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                            <input type="checkbox" className="h-4 w-4" checked={r.paid} disabled={!r.answer || busy === r.studentId} onChange={() => togglePaid(r)} />
                                            Payé
                                        </label>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    {/* Desktop: table */}
                    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 md:block">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-start text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <tr>
                                    <th className="px-3 py-2 text-start">Élève</th>
                                    <th className="px-3 py-2 text-start">Parent</th>
                                    <th className="px-3 py-2 text-start">Réponse</th>
                                    <th className="px-3 py-2 text-start">Note</th>
                                    {showPaid && <th className="px-3 py-2 text-start">Payé</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {rows.map((r) => {
                                    const a = ANSWER[r.answer ?? 'NONE'];
                                    return (
                                        <tr key={r.studentId} className="bg-white dark:bg-slate-900">
                                            <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">
                                                {r.name} {r.surname}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                                {r.parentName ?? '—'} <bdi dir="ltr" className="text-xs text-slate-400">{r.parentPhone ?? ''}</bdi>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.cls}`}>{a.label}</span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-slate-500">{r.note ?? ''}</td>
                                            {showPaid && (
                                                <td className="px-3 py-2">
                                                    <input type="checkbox" className="h-4 w-4" checked={r.paid} disabled={!r.answer || busy === r.studentId} onChange={() => togglePaid(r)} />
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
