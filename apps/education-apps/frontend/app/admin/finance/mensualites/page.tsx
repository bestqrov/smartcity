'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useI18n, appLocale } from '@/lib/i18n/I18nProvider';
import { describeApiError } from '@/lib/apiError';
import { levelLabel } from '@/lib/levels';
import { collectMonth, getDues, type DueRow, type DuesList } from '@/lib/services/schoolMode';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const STATUS_CLS = { PAID: 'bg-emerald-50 text-emerald-700', PARTIAL: 'bg-amber-50 text-amber-800', UNPAID: 'bg-red-50 text-red-700' };
const STATUS_TXT = { PAID: 'Payé', PARTIAL: 'Partiel', UNPAID: 'Non payé' };
const HEADERS = ['Élève', 'Niveau', 'Mensualité', 'Payé', 'Statut', ''];

// Monthly tuition: who paid this month, who did not; collect a month or remind the parent.
export default function MensualitesPage() {
    const { tr } = useI18n();
    const [month, setMonth] = useState(thisMonth());
    const [data, setData] = useState<DuesList | null>(null);
    const [level, setLevel] = useState('');
    const [error, setError] = useState('');
    // Student whose month is being collected; while set, every collect button is disabled.
    const [busy, setBusy] = useState<string | null>(null);
    const load = useCallback(async () => {
        try {
            setData(await getDues(month));
        } catch (e) {
            setData(null);
            setError(describeApiError(e, tr, 'Impossible de charger les mensualités'));
        }
    }, [month, tr]);
    useEffect(() => { setError(''); load(); }, [load]);

    const rows = useMemo(() => (data?.rows ?? []).filter((r) => !level || r.level === level), [data, level]);
    const levels = useMemo(() => Array.from(new Set((data?.rows ?? []).map((r) => r.level).filter(Boolean))) as string[], [data]);
    const monthName = /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T12:00:00`).toLocaleDateString(appLocale(), { month: 'long', year: 'numeric' }) : month;
    const remind = (r: DueRow) => {
        const digits = String(r.parentPhone ?? '').replace(/\D/g, '').replace(/^0/, '212');
        const text = encodeURIComponent(tr('Bonjour, nous vous rappelons que la mensualité de {month} de {name} ({amount} MAD) reste à régler. Merci.', { month: monthName, name: `${r.name} ${r.surname}`, amount: r.remaining }));
        return `https://wa.me/${digits}?text=${text}`;
    };
    const collect = async (r: DueRow) => {
        if (busy) return;
        setBusy(r.studentId);
        setError('');
        try {
            await collectMonth({ studentId: r.studentId, forMonth: month, amount: r.remaining, method: 'CASH' });
            await load();
        } catch (e) {
            setError(describeApiError(e, tr, "Échec de l'encaissement"));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('Mensualités')}</h1>
                    <p className="text-gray-600 dark:text-gray-300">{tr('Suivi des mensualités de scolarité, de septembre à juin')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 dark:border-white/10 dark:bg-white/5" aria-label={tr('Mois')} />
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-xl border border-gray-300 px-3 py-2 dark:border-white/10 dark:bg-white/5" aria-label={tr('Niveau')}>
                        <option value="">{tr('Tous les niveaux')}</option>
                        {levels.map((l) => <option key={l} value={l}>{tr(levelLabel(l))}</option>)}
                    </select>
                </div>
            </div>
            {data && (
                <div className="grid gap-4 sm:grid-cols-3">
                    {([['Attendu', data.totals.expected], ['Encaissé', data.totals.collected], ['Reste à encaisser', data.totals.remaining]] as const).map(([k, v]) => (
                        <div key={k} className="vib-card p-5">
                            <p className="text-sm text-gray-500">{tr(k)}</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white"><bdi dir="ltr">{v}</bdi> {tr('MAD')}</p>
                        </div>
                    ))}
                </div>
            )}
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            {data && data.rows.length === 0 && <p className="vib-card p-6 text-gray-600">{tr('Aucune mensualité ce mois-ci (vacances d’été ou aucun élève inscrit avec une mensualité).')}</p>}
            {rows.length > 0 && (
                <div className="vib-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 dark:bg-white/5">
                            <tr>{HEADERS.map((h) => <th key={h} className="px-4 py-3 text-start">{h && tr(h)}</th>)}</tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.studentId} className="border-t border-gray-100 dark:border-white/5">
                                    <td className="px-4 py-3 font-semibold">{r.surname} {r.name}</td>
                                    <td className="px-4 py-3">{tr(levelLabel(r.level))}</td>
                                    <td className="px-4 py-3"><bdi dir="ltr">{r.due}</bdi> {tr('MAD')}</td>
                                    <td className="px-4 py-3"><bdi dir="ltr">{r.paid}</bdi> {tr('MAD')}</td>
                                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_CLS[r.status]}`}>{tr(STATUS_TXT[r.status])}</span></td>
                                    <td className="px-4 py-3">
                                        {r.status !== 'PAID' && (
                                            <div className="flex gap-2">
                                                <button type="button" disabled={busy !== null} aria-busy={busy === r.studentId} onClick={() => collect(r)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
                                                    {busy === r.studentId ? tr('Encaissement…') : tr('Encaisser {amount} MAD', { amount: r.remaining })}
                                                </button>
                                                {r.parentPhone && (
                                                    <a href={remind(r)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-bold text-emerald-700">
                                                        <MessageCircle size={14} />{tr('Rappel')}
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
