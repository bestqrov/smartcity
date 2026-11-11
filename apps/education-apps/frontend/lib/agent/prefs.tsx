'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLangTheme, type DashboardTheme } from '@/lib/dashboard/prefs';
import { agentMessages, type AgentLang, type AgentMessages } from './messages';

// Language and theme: see useLangTheme (same approach as the landing page, theme shared with the admin TopBar).
const LANG_KEY = 'agent-lang';

export type AgentTheme = DashboardTheme;

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

export function AgentPrefsProvider({ children }: { children: React.ReactNode }) {
    const { lang, setLang, theme, toggleTheme } = useLangTheme(LANG_KEY);
    const [section, setSection] = useState<{ id: AgentSection; n: number }>({ id: 'overview', n: 0 });

    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        if (isAgentSection(hash)) setSection({ id: hash, n: 1 });
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
