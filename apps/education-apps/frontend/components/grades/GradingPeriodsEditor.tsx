'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { getSettings, updateSettings } from '@/lib/services/settings';
import { apiErrorMessage } from '@/lib/services/grades';

const PRESETS: Record<string, string[]> = {
    Semestres: ['Semestre 1', 'Semestre 2'],
    Trimestres: ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'],
};
const MAX = 6;
const MAX_LEN = 30;

/** "Périodes de notation" editor (settings page), saved through PUT /settings. */
export default function GradingPeriodsEditor() {
    const [periods, setPeriods] = useState<string[]>([]);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        getSettings()
            .then((s) => setPeriods(s.gradingPeriods ?? []))
            .catch(() => undefined);
    }, []);

    const validate = (list: string[]): string | null => {
        const clean = list.map((p) => p.trim());
        if (clean.length < 1 || clean.length > MAX) return `Entre 1 et ${MAX} périodes`;
        if (clean.some((p) => !p || p.length > MAX_LEN)) return `Noms non vides, ${MAX_LEN} caractères maximum`;
        if (new Set(clean.map((p) => p.toLowerCase())).size !== clean.length) return 'Les noms doivent être distincts';
        return null;
    };

    const add = () => {
        const name = draft.trim();
        if (!name) return;
        setPeriods((p) => [...p, name]);
        setDraft('');
    };

    const save = async () => {
        const err = validate(periods);
        if (err) return setMessage({ ok: false, text: err });
        setSaving(true);
        setMessage(null);
        try {
            const s = await updateSettings({ gradingPeriods: periods.map((p) => p.trim()) });
            setPeriods(s.gradingPeriods ?? periods);
            setMessage({ ok: true, text: 'Périodes enregistrées' });
        } catch (e) {
            setMessage({ ok: false, text: apiErrorMessage(e, "Échec de l'enregistrement") });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Périodes de notation</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                    Les évaluations et les bulletins sont regroupés par période. Les évaluations existantes gardent leur ancienne période : renommer ou supprimer une période n’affecte pas les évaluations déjà créées.
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                {Object.entries(PRESETS).map(([label, list]) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => setPeriods(list)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                {periods.map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-50 py-1 pl-3 pr-1 dark:bg-blue-500/15">
                        <input
                            value={p}
                            maxLength={MAX_LEN}
                            aria-label={`Période ${i + 1}`}
                            onChange={(e) => setPeriods((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                            size={Math.max(p.length, 4)}
                            className="bg-transparent text-sm font-medium text-blue-800 focus:outline-none dark:text-blue-200"
                        />
                        <button
                            type="button"
                            aria-label="Retirer"
                            onClick={() => setPeriods((prev) => prev.filter((_, j) => j !== i))}
                            className="rounded-full p-1 text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-500/20"
                        >
                            <X size={14} />
                        </button>
                    </span>
                ))}
            </div>
            {periods.length < MAX && (
                <div className="flex gap-2">
                    <input
                        value={draft}
                        maxLength={MAX_LEN}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                add();
                            }
                        }}
                        placeholder="Nouvelle période"
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                    <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:text-slate-200">
                        <Plus size={16} /> Ajouter
                    </button>
                </div>
            )}
            {message && <p className={`text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                    <Save size={18} /> {saving ? 'Enregistrement…' : 'Enregistrer les périodes'}
                </button>
            </div>
        </div>
    );
}
