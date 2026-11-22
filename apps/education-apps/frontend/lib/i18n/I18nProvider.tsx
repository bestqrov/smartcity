'use client';

// Language of the school staff spaces (owner, admin, secretary) and the login / signup pages.
// French is the source language: every UI string is written in French and wrapped in `tr()`;
// the Arabic dictionary maps that French text to its Arabic translation. A missing entry falls back to French.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AR } from './ar';

export type AppLang = 'fr' | 'ar';
export type TrParams = Record<string, string | number | null | undefined>;

const STORAGE_KEY = 'app-lang';
// The landing page's choice is the fallback, so a visitor who picked Arabic there lands in Arabic.
const LANDING_KEY = 'landing-lang';

const interpolate = (text: string, params?: TrParams) =>
    params ? text.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key] ?? '') : match)) : text;

// Empty for a missing value, so `tr(error)` can wrap an optional message directly.
export const translate = (lang: AppLang, text: string | null | undefined, params?: TrParams): string =>
    text == null ? '' : interpolate(lang === 'ar' ? AR[text] ?? text : text, params);

// Current language for plain helpers (date / money formatting) that are not React components.
// Set by the provider while it renders, so it is up to date before any child formats a value.
let currentLang: AppLang = 'fr';
export const appLang = (): AppLang => currentLang;
export const appLocale = (): string => (currentLang === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR');

const read = (key: string) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

interface I18nValue {
    lang: AppLang;
    dir: 'ltr' | 'rtl';
    setLang: (lang: AppLang) => void;
    tr: (text: string | null | undefined, params?: TrParams) => string;
    // Locale for dates and numbers (Moroccan Arabic keeps Latin digits, as on official school documents).
    locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
    // 'fr' on the server and the first client render (no hydration mismatch), then the saved choice.
    const [lang, setLangState] = useState<AppLang>('fr');

    useEffect(() => {
        const saved = read(STORAGE_KEY) ?? read(LANDING_KEY);
        if (saved === 'fr' || saved === 'ar') setLangState(saved);
        else if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')) setLangState('ar');
    }, []);

    // <html lang/dir> drive the Arabic font and the RTL layout (portals and modals included); restored on leave.
    useEffect(() => {
        const root = document.documentElement;
        const before = { lang: root.lang, dir: root.dir };
        root.lang = lang;
        root.dir = lang === 'ar' ? 'rtl' : 'ltr';
        return () => {
            root.lang = before.lang || 'fr';
            root.dir = before.dir || 'ltr';
        };
    }, [lang]);

    const setLang = useCallback((next: AppLang) => {
        setLangState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // storage unavailable: the choice lasts for this visit
        }
    }, []);

    currentLang = lang;
    const value = useMemo<I18nValue>(
        () => ({
            lang,
            dir: lang === 'ar' ? 'rtl' : 'ltr',
            setLang,
            tr: (text, params) => translate(lang, text, params),
            locale: appLocale(),
        }),
        [lang, setLang]
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Outside a provider (a component reused by a space that is not translated yet) everything stays French.
const FALLBACK: I18nValue = { lang: 'fr', dir: 'ltr', setLang: () => {}, tr: (text, params) => (text == null ? '' : interpolate(text, params)), locale: 'fr-FR' };

export function useI18n(): I18nValue {
    return useContext(I18nContext) ?? FALLBACK;
}
