'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ParentLang } from './messages';

const STORAGE_KEY = 'parent-lang';

// Same rule as useLandingLang: French by default, Arabic when the browser is Arabic,
// a saved choice always wins. Starts as 'fr' to avoid a hydration mismatch.
export function useParentLang(): [ParentLang, (lang: ParentLang) => void] {
    const [lang, setLangState] = useState<ParentLang>('fr');

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

    const setLang = useCallback((next: ParentLang) => {
        setLangState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore
        }
    }, []);

    return [lang, setLang];
}
