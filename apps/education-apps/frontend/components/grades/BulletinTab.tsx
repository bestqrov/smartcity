'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Printer } from 'lucide-react';
import { getBulletin, apiErrorMessage, type Bulletin, type BulletinRow, type EvaluationWithGrades } from '@/lib/services/grades';
import { getSettings } from '@/lib/services/settings';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import BulletinPrint from './BulletinPrint';
import { fixed2 } from './utils';

interface Props {
    groupId: string;
    groupName: string;
    periods: string[];
    evaluations: EvaluationWithGrades[];
}

export default function BulletinTab({ groupId, groupName, periods, evaluations }: Props) {
    const [period, setPeriod] = useState(periods[0] ?? '');
    const [bulletin, setBulletin] = useState<Bulletin | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [printRows, setPrintRows] = useState<BulletinRow[] | null>(null);
    const [academicYear, setAcademicYear] = useState<string | null>(null);
    const { profile } = useSchoolProfile();

    useEffect(() => {
        if (!period && periods.length) setPeriod(periods[0]);
    }, [periods, period]);

    useEffect(() => {
        getSettings().then((s) => setAcademicYear(s.academicYear || null)).catch(() => undefined);
    }, []);

    useEffect(() => {
        if (!period) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        getBulletin(groupId, period)
            .then((b) => !cancelled && setBulletin(b))
            .catch((err) => !cancelled && setError(apiErrorMessage(err)))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [groupId, period, evaluations]);

    // Coefficient column only when each subject uses a single coefficient in this period.
    const coefficients = useMemo(() => {
        if (!bulletin) return null;
        const map: Record<string, Set<number>> = {};
        evaluations
            .filter((e) => e.published && e.period === period)
            .forEach((e) => (map[e.subject] ??= new Set()).add(e.coefficient));
        const out: Record<string, number> = {};
        for (const s of bulletin.subjects) {
            if (!map[s] || map[s].size !== 1) return null;
            out[s] = Array.from(map[s])[0];
        }
        return out;
    }, [bulletin, evaluations, period]);

    const exportExcel = async () => {
        if (!bulletin) return;
        const XLSX = await import('xlsx');
        const data = bulletin.rows.map((r) => {
            const line: Record<string, string | number> = { Nom: r.surname, Prénom: r.name };
            bulletin.subjects.forEach((s) => {
                const v = r.averages[s];
                line[s] = v === null || v === undefined ? '' : Math.round(v * 100) / 100;
            });
            line['Moyenne générale'] = r.general === null ? '' : Math.round(r.general * 100) / 100;
            line['Rang'] = r.rank ?? '';
            return line;
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bulletin');
        XLSX.writeFile(wb, `bulletin-${groupName}-${period}.xlsx`.replace(/[\\/:*?"<>|\s]+/g, '_'));
    };

    if (!periods.length) {
        return <p className="text-sm text-slate-500">Aucune période de notation configurée.</p>;
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                >
                    {periods.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={exportExcel}
                    disabled={!bulletin?.rows.length}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                    <FileSpreadsheet size={16} /> Exporter Excel
                </button>
                <button
                    type="button"
                    onClick={() => bulletin && setPrintRows(bulletin.rows)}
                    disabled={!bulletin?.rows.length}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    <Printer size={16} /> Imprimer les bulletins
                </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Seules les évaluations publiées comptent. Moyennes ramenées sur 20.</p>
            {loading && <Loader2 className="animate-spin text-slate-400" />}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {bulletin && !loading && (
                bulletin.rows.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucun élève.</p>
                ) : (
                    <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                                <tr>
                                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 dark:bg-slate-900">Élève</th>
                                    {bulletin.subjects.map((s) => (
                                        <th key={s} className="whitespace-nowrap px-3 py-2">{s}</th>
                                    ))}
                                    <th className="whitespace-nowrap px-3 py-2">Générale</th>
                                    <th className="px-3 py-2">Rang</th>
                                    <th className="px-3 py-2" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                                {bulletin.rows.map((r) => (
                                    <tr key={r.studentId}>
                                        <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-900 dark:bg-slate-800 dark:text-white">
                                            {r.surname} {r.name}
                                        </td>
                                        {bulletin.subjects.map((s) => (
                                            <td key={s} className="px-3 py-2 text-slate-700 dark:text-slate-200">{fixed2(r.averages[s])}</td>
                                        ))}
                                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">{fixed2(r.general)}</td>
                                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.rank ?? '—'}</td>
                                        <td className="px-2 py-2">
                                            <button type="button" aria-label="Imprimer le bulletin" onClick={() => setPrintRows([r])} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                                                <Printer size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
            {printRows && bulletin && (
                <BulletinPrint
                    bulletin={bulletin}
                    rows={printRows}
                    groupName={groupName}
                    schoolName={profile.schoolName}
                    logo={profile.logoUrl || profile.logo}
                    academicYear={academicYear}
                    coefficients={coefficients}
                    onDone={() => setPrintRows(null)}
                />
            )}
        </div>
    );
}
