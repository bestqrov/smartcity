'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getOnboarding, updateOnboarding, type OnboardingState, type OnboardingUpdate } from '@/lib/services/onboarding';

export const ONBOARDING_CHANGED = 'onboarding:changed';

/**
 * Checklist state of the current branch. Refetched on every route change (so a step ticks as soon as the admin
 * comes back from saving) and when another component changes it. A load error leaves `state` null: callers
 * render nothing rather than breaking the page.
 */
export function useOnboarding(enabled: boolean) {
    const pathname = usePathname();
    const [state, setState] = useState<OnboardingState | null>(null);

    const load = useCallback(() => {
        if (!enabled) return;
        getOnboarding().then(setState).catch(() => setState(null));
    }, [enabled]);

    useEffect(() => {
        load();
    }, [load, pathname]);

    useEffect(() => {
        window.addEventListener(ONBOARDING_CHANGED, load);
        return () => window.removeEventListener(ONBOARDING_CHANGED, load);
    }, [load]);

    const update = useCallback(async (body: OnboardingUpdate) => {
        const next = await updateOnboarding(body);
        setState(next);
        window.dispatchEvent(new Event(ONBOARDING_CHANGED));
    }, []);

    return { state, update };
}
