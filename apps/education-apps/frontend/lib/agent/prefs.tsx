'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { agentMessages, type AgentLang, type AgentMessages } from './messages';

// Language: same approach as the landing page (lib/landing/useLandingLang): a saved choice wins, otherwise the
// landing page's choice, otherwise Arabic for an Arabic browser, otherwise French.
const LANG_KEY = 'agent-lang';
const LANDING_LANG_KEY = 'landing-lang';
// Theme: same localStorage key as the admin TopBar, so the choice is shared across the app.
const THEME_KEY = 'app-theme';

export type AgentTheme = 'light' | 'dark';

// Dashboard sections reachable from the sidebar; `n` makes a repeated click on the same entry scroll again.
export type AgentSection = 'overview' | 'clients' | 'commissions' | 'payouts' | 'rates';
export const AGENT_SECTIONS: AgentSection[] = ['overview', 'clients', 'commissions', 'payouts', 'rates'];
export const isAgentSection = (value: string): value is AgentSection => (AGENT_SECTIONS as string[]).includes(value);

interface AgentPrefs {
    lang: AgentLang;
    setLang: (lang: AgentLang) => void;
    m: AgentMessages;
    theme: AgentTheme;
    toggleTheme: () => void;
    section: { id: AgentSection; n: number };
    goToSection: (id: AgentSection) => void;
}

const AgentPrefsContext = createContext<AgentPrefs | null>(null);

const read = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};
const write = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // storage unavailable: the choice lasts for this visit only
    }
};

export function AgentPrefsProvider({ children }: { children: React.ReactNode }) {
    // 'fr' / 'light' on the server and the first client render (no hydration mismatch), then adjusted.
    const [lang, setLangState] = useState<AgentLang>('fr');
    const [theme, setTheme] = useState<AgentTheme>('light');
    const [section, setSection] = useState<{ id: AgentSection; n: number }>({ id: 'overview', n: 0 });

    useEffect(() => {
        const saved = read(LANG_KEY) ?? read(LANDING_LANG_KEY);
        if (saved === 'fr' || saved === 'ar') setLangState(saved);
        else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')) setLangState('ar');

        const savedTheme = read(THEME_KEY);
        if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
        else {
            try {
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
            } catch {
                // matchMedia unavailable: stay light
            }
        }

        const hash = window.location.hash.replace('#', '');
        if (isAgentSection(hash)) setSection({ id: hash, n: 1 });
    }, []);

    // Keep <html> in sync (the body background and portals follow it), and restore it when leaving the agent space.
    useEffect(() => {
        const root = document.documentElement;
        const had = root.classList.contains('dark');
        root.classList.toggle('dark', theme === 'dark');
        return () => {
            root.classList.toggle('dark', had);
        };
    }, [theme]);

    const setLang = useCallback((next: AgentLang) => {
        setLangState(next);
        write(LANG_KEY, next);
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme((current) => {
            const next = current === 'dark' ? 'light' : 'dark';
            write(THEME_KEY, next);
            return next;
        });
    }, []);

    const goToSection = useCallback((id: AgentSection) => setSection((s) => ({ id, n: s.n + 1 })), []);

    const value = useMemo(
        () => ({ lang, setLang, m: agentMessages[lang], theme, toggleTheme, section, goToSection }),
        [lang, setLang, theme, toggleTheme, section, goToSection]
    );
    return <AgentPrefsContext.Provider value={value}>{children}</AgentPrefsContext.Provider>;
}

export function useAgentPrefs(): AgentPrefs {
    const ctx = useContext(AgentPrefsContext);
    if (!ctx) throw new Error('useAgentPrefs must be used inside AgentPrefsProvider');
    return ctx;
}
