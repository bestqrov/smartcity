'use client';

// Language + theme preferences of the espresso dashboards (sales agent space, super admin platform).
import { useCallback, useEffect, useState } from 'react';
import type { AgentLang } from '@/lib/agent/messages';

const LANDING_LANG_KEY = 'landing-lang';
// Same localStorage key as the admin TopBar, so the theme choice is shared across the app.
const THEME_KEY = 'app-theme';

export type DashboardLang = AgentLang;
export type DashboardTheme = 'light' | 'dark';

export const readPref = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};
const writePref = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // storage unavailable: the choice lasts for this visit only
    }
};

// Language: a saved choice (under `langKey`) wins, otherwise the landing page's choice, otherwise Arabic for an
// Arabic browser, otherwise French. Theme: saved choice, otherwise the system preference.
export function useLangTheme(langKey: string) {
    // 'fr' / 'light' on the server and the first client render (no hydration mismatch), then adjusted.
    const [lang, setLangState] = useState<DashboardLang>('fr');
    const [theme, setTheme] = useState<DashboardTheme>('light');

    useEffect(() => {
        const saved = readPref(langKey) ?? readPref(LANDING_LANG_KEY);
        if (saved === 'fr' || saved === 'ar') setLangState(saved);
        else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')) setLangState('ar');

        const savedTheme = readPref(THEME_KEY);
        if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
        else {
            try {
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
            } catch {
                // matchMedia unavailable: stay light
            }
        }
    }, [langKey]);

    // Keep <html> in sync (the body background and portals follow it), and restore it when leaving the dashboard.
    useEffect(() => {
        const root = document.documentElement;
        const had = root.classList.contains('dark');
        root.classList.toggle('dark', theme === 'dark');
        return () => {
            root.classList.toggle('dark', had);
        };
    }, [theme]);

    const setLang = useCallback(
        (next: DashboardLang) => {
            setLangState(next);
            writePref(langKey, next);
        },
        [langKey]
    );

    const toggleTheme = useCallback(() => {
        setTheme((current) => {
            const next = current === 'dark' ? 'light' : 'dark';
            writePref(THEME_KEY, next);
            return next;
        });
    }, []);

    return { lang, setLang, theme, toggleTheme };
}
