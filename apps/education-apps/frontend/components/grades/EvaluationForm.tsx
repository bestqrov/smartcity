'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Evaluation, GradesClient } from '@/lib/services/grades';
import { apiErrorMessage } from '@/lib/services/grades';
import { parseScore, todayIso } from './utils';

const LAST_PERIOD_KEY = 'grades:lastPeriod';

interface Props {
    client: GradesClient;
    groupId: string;
    periods: string[];
    defaultSubject?: string;
    /** Edit mode when provided. */
    evaluation?: Evaluation | null;
    onClose: () => void;
    onSaved: (ev: Evaluation) => void;
}

const inputCls =
    'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function EvaluationForm({ client, groupId, periods, defaultSubject, evaluation, onClose, onSaved }: Props) {
    const lastPeriod = (() => {
        try {
            const v = localStorage.getItem(LAST_PERIOD_KEY);
            return v && periods.includes(v) ? v : null;
        } catch {
            return null;
        }
    })();
    const [title, setTitle] = useState(evaluation?.title ?? '');
    const [subject, setSubject] = useState(evaluation?.subject ?? defaultSubject ?? '');
    const [period, setPeriod] = useState(evaluation?.period ?? lastPeriod ?? periods[0] ?? '');
    const [date, setDate] = useState(evaluation ? evaluation.date.slice(0, 10) : todayIso());
    const [maxScore, setMaxScore] = useState(String(evaluation?.maxScore ?? 20));
    const [coefficient, setCoefficient] = useState(String(evaluation?.coefficient ?? 1));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const max = parseScore(maxScore);
        const coef = parseScore(coefficient);
        if (!title.trim()) return setError('Le titre est obligatoire');
        if (!period) return setError('Choisissez une période');
        if (max === null || Number.isNaN(max) || max <= 0) return setError('Barème invalide');
        if (coef === null || Number.isNaN(coef) || coef <= 0) return setError('Coefficient invalide');
        setSaving(true);
        setError(null);
        try {
            const payload = { title: title.trim(), period, date, maxScore: max, coefficient: coef, ...(subject.trim() ? { subject: subject.trim() } : {}) };
            const saved = evaluation
                ? await client.updateEvaluation(evaluation.id, payload)
                : await client.createEvaluation({ groupId, ...payload });
            try {
                localStorage.setItem(LAST_PERIOD_KEY, period);
            } catch {
                /* ignore */
            }
            onSaved(saved);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 dark:bg-slate-800 sm:rounded-2xl"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {evaluation ? "Modifier l'évaluation" : 'Nouvelle évaluation'}
                    </h2>
                    <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>
                <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Titre
                    <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contrôle 1" autoFocus />
                </label>
                <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Matière
                    <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Matière du groupe" />
                </label>
                <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Période
                    <select className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
                        {evaluation && !periods.includes(evaluation.period) && <option value={evaluation.period}>{evaluation.period}</option>}
                        {periods.map((p) => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    Date
                    <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Barème
                        <input inputMode="decimal" className={inputCls} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
                    </label>
                    <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                        Coefficient
                        <input inputMode="decimal" className={inputCls} value={coefficient} onChange={(e) => setCoefficient(e.target.value)} />
                    </label>
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
            </form>
        </div>
    );
}
