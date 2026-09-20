'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Lang } from './messages';

const STORAGE_KEY = 'landing-lang';

// French by default; Arabic when the browser is Arabic; a saved choice always wins.
// Starts as 'fr' on the server and first client render (no hydration mismatch), then adjusts.
export function useLandingLang(): [Lang, (lang: Lang) => void] {
    const [lang, setLangState] = useState<Lang>('fr');

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'fr' || saved === 'ar') {
                setLangState(saved);
                return;
            }
        } catch {
            // storage unavailable: fall through to the browser language
        }
        if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')) {
            setLangState('ar');
        }
    }, []);

    const setLang = useCallback((next: Lang) => {
        setLangState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore
        }
    }, []);

    return [lang, setLang];
}
