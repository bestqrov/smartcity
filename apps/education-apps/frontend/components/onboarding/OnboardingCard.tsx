'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { STEP_HINTS, STEP_LABELS } from '@/lib/onboarding/labels';
import { nextStep } from '@/lib/services/onboarding';
import { useOnboarding } from '@/hooks/useOnboarding';
import useAuthStore from '@/store/useAuthStore';

/** «Configurer votre établissement»: the ordered setup steps, ticked from the data. Hidden when complete or hidden. */
export default function OnboardingCard() {
    const { tr } = useI18n();
    const role = useAuthStore((s) => s.user?.role);
    const { state, update } = useOnboarding(role === 'ADMIN' || role === 'OWNER');
    const [error, setError] = useState('');

    if (!state || state.completed || state.dismissed) return null;
    const doneCount = state.steps.filter((s) => s.done || s.skipped).length;
    const next = nextStep(state);
    const act = (body: Parameters<typeof update>[0]) =>
        update(body).catch((err) => setError(err?.response?.data?.error || err?.message || 'Erreur'));

    return (
        <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900" aria-labelledby="onb-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id="onb-title" className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {tr('Configurer votre établissement')} <span className="tabular-nums text-indigo-600">· {doneCount}/{state.steps.length}</span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr('Suivez ces étapes dans l’ordre : les inscriptions seront ensuite rapides.')}</p>
                </div>
                <button type="button" onClick={() => act({ dismissed: true })} className="text-sm font-semibold text-slate-500 hover:underline">
                    {tr('Masquer')}
                </button>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden="true">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(doneCount / state.steps.length) * 100}%` }} />
            </div>
            <ol className="mt-4 space-y-2">
                {state.steps.map((s, i) => (
                    <li key={s.key} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${s.key === next?.key ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''} ${s.skipped ? 'opacity-60' : ''}`}>
                        {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" /> : <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />}
                        <div className="min-w-0 flex-1">
                            <Link href={s.href} className="font-semibold text-slate-800 hover:underline dark:text-slate-100">
                                {i + 1}. {tr(STEP_LABELS[s.key])}
                            </Link>
                            {s.optional && <span className="ms-2 text-xs text-slate-400">{tr('Optionnel')}</span>}
                            {!s.done && <div className="text-xs text-slate-500 dark:text-slate-400">{tr(STEP_HINTS[s.key])}</div>}
                        </div>
                        {s.key === 'firstStudent' && !s.done && (
                            <Link href="/admin/inscriptions/import" className="text-xs font-semibold text-indigo-600 hover:underline">{tr('Importer Excel')}</Link>
                        )}
                        {s.optional && !s.done && (
                            <button type="button" onClick={() => act(s.skipped ? { unskip: s.key } : { skip: s.key })} className="text-xs font-semibold text-slate-500 hover:underline">
                                {s.skipped ? tr('Reprendre') : tr('Passer')}
                            </button>
                        )}
                    </li>
                ))}
            </ol>
            {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
            {next && (
                <div className="mt-4 flex justify-end">
                    <Link href={next.href} className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700">
                        {tr('Continuer')} <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
                    </Link>
                </div>
            )}
        </section>
    );
}
