'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { describeApiError } from '@/lib/apiError';
import { LEVELS } from '@/lib/schoolLevels';
import { getTuitionGrid, saveTuitionGrid, type TuitionRow } from '@/lib/services/schoolMode';

const FIELDS: { key: keyof Omit<TuitionRow, 'level'>; label: string }[] = [
    { key: 'inscriptionFee', label: "Frais d'inscription" },
    { key: 'monthlyFee', label: 'Mensualité' },
    { key: 'insuranceFee', label: 'Assurance (année)' },
];

// Fees per level of a complete private school (the inscription form reads them).
export default function TuitionFeesTable() {
    const { tr } = useI18n();
    const [rows, setRows] = useState<TuitionRow[]>([]);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        getTuitionGrid().then(setRows).catch((e) => setMessage({ ok: false, text: describeApiError(e, tr, 'Impossible de charger les prix') }));
    }, [tr]);

    const set = (level: string, key: keyof Omit<TuitionRow, 'level'>, value: string) =>
        setRows((list) => list.map((r) => (r.level === level ? { ...r, [key]: value === '' ? 0 : Number(value) } : r)));
    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            setRows(await saveTuitionGrid(rows));
            setMessage({ ok: true, text: tr('Tarifs enregistrés') });
        } catch (e) {
            setMessage({ ok: false, text: describeApiError(e, tr, "Échec de l'enregistrement") });
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800">{tr('Frais de scolarité par niveau')}</h2>
            <p className="mt-1 text-sm text-gray-600">{tr("Utilisés automatiquement par le formulaire d'inscription. Les élèves déjà inscrits gardent leur mensualité.")}</p>
            <div className="mt-4 overflow-x-auto">
                <table className="w-full text-start text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="px-3 py-2 text-start">{tr('Niveau')}</th>
                            {FIELDS.map((f) => <th key={f.key} className="px-3 py-2 text-start">{tr(f.label)} ({tr('MAD')})</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.level} className="border-t border-gray-100">
                                <td className="px-3 py-2 font-semibold text-gray-800">{tr(LEVELS.find((l) => l.code === row.level)?.label ?? row.level)}</td>
                                {FIELDS.map((f) => (
                                    <td key={f.key} className="px-3 py-2">
                                        <input type="number" min="0" step="1" dir="ltr" value={row[f.key] || ''} onChange={(e) => set(row.level, f.key, e.target.value)} placeholder="0" className="w-28 rounded-lg border border-gray-300 px-2 py-1.5" aria-label={`${tr(f.label)} — ${row.level}`} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex items-center gap-3">
                <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60">
                    {saving ? tr('Enregistrement…') : tr('Enregistrer')}
                </button>
                {message && <span className={`text-sm font-semibold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</span>}
            </div>
        </section>
    );
}
