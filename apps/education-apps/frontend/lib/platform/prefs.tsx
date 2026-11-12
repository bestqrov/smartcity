'use client';

import { createContext, useContext, useMemo } from 'react';
import { useLangTheme, type DashboardLang, type DashboardTheme } from '@/lib/dashboard/prefs';
import { platformMessages, type PlatformMessages } from './messages';

// Language and theme of the super admin platform dashboard (own language key, theme shared app-wide).
const LANG_KEY = 'platform-lang';

interface PlatformPrefs {
    lang: DashboardLang;
    setLang: (lang: DashboardLang) => void;
    m: PlatformMessages;
    theme: DashboardTheme;
    toggleTheme: () => void;
}

const PlatformPrefsContext = createContext<PlatformPrefs | null>(null);

export function PlatformPrefsProvider({ children }: { children: React.ReactNode }) {
    const { lang, setLang, theme, toggleTheme } = useLangTheme(LANG_KEY);
    const value = useMemo(() => ({ lang, setLang, m: platformMessages[lang], theme, toggleTheme }), [lang, setLang, theme, toggleTheme]);
    return <PlatformPrefsContext.Provider value={value}>{children}</PlatformPrefsContext.Provider>;
}

export function usePlatformPrefs(): PlatformPrefs {
    const ctx = useContext(PlatformPrefsContext);
    if (!ctx) throw new Error('usePlatformPrefs must be used inside PlatformPrefsProvider');
    return ctx;
}
