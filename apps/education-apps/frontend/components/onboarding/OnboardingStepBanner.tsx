'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { STEP_LABELS } from '@/lib/onboarding/labels';
import { nextStep } from '@/lib/services/onboarding';
import { useOnboarding } from '@/hooks/useOnboarding';
import useAuthStore from '@/store/useAuthStore';

/** «Étape 4/7 · Classes et groupes» on the page of a setup step, while the checklist is open. */
export default function OnboardingStepBanner() {
    const { tr } = useI18n();
    const pathname = usePathname();
    const role = useAuthStore((s) => s.user?.role);
    const { state, update } = useOnboarding(role === 'ADMIN' || role === 'OWNER');

    if (!state || state.completed || state.dismissed || !pathname) return null;
    const index = state.steps.findIndex((s) => s.href === pathname);
    if (index < 0) return null;
    const step = state.steps[index];
    const next = nextStep(state);
    const showNext = step.done && next && next.key !== step.key;

    return (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm dark:border-indigo-900 dark:bg-indigo-950/40">
            <span className="font-semibold text-indigo-900 dark:text-indigo-100">
                {tr('Étape')} <span className="tabular-nums">{index + 1}/{state.steps.length}</span> · {tr(STEP_LABELS[step.key])}
                {step.done && ' ✅'}
            </span>
            <span className="flex items-center gap-3">
                {step.optional && !step.done && (
                    <button type="button" onClick={() => update({ skip: step.key }).catch(() => {})} className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                        {tr('Passer')}
                    </button>
                )}
                {showNext && (
                    <Link href={next.href} className="rounded-full bg-indigo-600 px-4 py-1 font-bold text-white hover:bg-indigo-700">
                        {tr('Suivant')} ›
                    </Link>
                )}
            </span>
        </div>
    );
}
