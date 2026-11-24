'use client';

import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { CYCLES } from '@/lib/schoolLevels';
import { updateSettings } from '@/lib/services/settings';
import { useSchoolCycles } from '@/hooks/useSchoolCycles';
import { describeApiError } from '@/lib/apiError';

const currentYear = () => {
    const now = new Date();
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${start}/${start + 1}`;
};

// Turns on the complete private school mode: professional inscription, fees per level, monthly dues.
export default function SchoolCyclesCard() {
    const { tr } = useI18n();
    const { cycles, schoolYear, loading, reload } = useSchoolCycles();
    const [chosen, setChosen] = useState<string[]>([]);
    const [year, setYear] = useState('');
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        setChosen(cycles);
        setYear(schoolYear ?? currentYear());
    }, [cycles, schoolYear]);

    const toggle = (key: string) => setChosen((list) => (list.includes(key) ? list.filter((c) => c !== key) : [...list, key]));
    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await updateSettings({ schoolCycles: chosen, schoolYear: year.trim() || null });
            setMessage({ ok: true, text: tr('Cycles enregistrés') });
            reload();
        } catch (e) {
            setMessage({ ok: false, text: describeApiError(e, tr, "Échec de l'enregistrement") });
        } finally {
            setSaving(false);
        }
    };
    if (loading) return null;

    return (
        <section className="rounded-2xl border border-gray-200 p-6 dark:border-white/10">
            <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                <GraduationCap size={20} aria-hidden="true" /> {tr("Cycles de l'établissement")}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {tr('Cochez les cycles de votre école : l’inscription passe au dossier complet (frais par niveau, code Massar, santé, mensualités).')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
                {CYCLES.map((c) => (
                    <label key={c.key} className={`cursor-pointer rounded-xl border-2 px-4 py-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-indigo-400 ${chosen.includes(c.key) ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200' : 'border-gray-200 text-gray-700 dark:border-white/10 dark:text-gray-200'}`}>
                        <input type="checkbox" className="sr-only" checked={chosen.includes(c.key)} onChange={() => toggle(c.key)} />
                        {tr(c.label)}
                    </label>
                ))}
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {tr('Année scolaire')}
                    <input dir="ltr" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026/2027" className="mt-1 block w-40 rounded-lg border border-gray-300 px-3 py-2 text-start dark:border-white/10 dark:bg-white/5" />
                </label>
                <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {saving ? tr('Enregistrement…') : tr('Enregistrer')}
                </button>
            </div>
            {message && <p role="status" className={`mt-3 text-sm font-semibold ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
        </section>
    );
}
