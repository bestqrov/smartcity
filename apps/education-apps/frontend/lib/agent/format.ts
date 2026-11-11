// Locale-aware formatters for the agent space. Arabic uses ar-MA with Western (latn) digits.
import type { AgentLang } from './messages';

export const localeOf = (lang: AgentLang): string => (lang === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR');

export const fmtNumber = (value: number, lang: AgentLang, digits = 0): string =>
    value.toLocaleString(localeOf(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits, numberingSystem: 'latn' } as Intl.NumberFormatOptions);

// "1 234,50 MAD" / "1.234,50 درهم"
export const fmtMAD = (value: number, lang: AgentLang): string => `${fmtNumber(value, lang, 2)} ${lang === 'ar' ? 'درهم' : 'MAD'}`;

// Compact amount for chart axes and labels: "1,2 k" / "1,2 ألف".
export const fmtMADShort = (value: number, lang: AgentLang): string => {
    if (Math.abs(value) >= 1000) return `${fmtNumber(Math.round(value / 100) / 10, lang, value % 1000 === 0 ? 0 : 1)}${lang === 'ar' ? ' ألف' : ' k'}`;
    return fmtNumber(Math.round(value), lang);
};

export const fmtDate = (value: string, lang: AgentLang): string =>
    new Date(value).toLocaleDateString(localeOf(lang), { numberingSystem: 'latn' } as Intl.DateTimeFormatOptions);

// For date-only values (e.g. paidAt stored at UTC midnight).
export const fmtDay = (value: string, lang: AgentLang): string =>
    new Date(value).toLocaleDateString(localeOf(lang), { timeZone: 'UTC', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions);

export const fmtMonthYear = (date: Date, lang: AgentLang): string =>
    date.toLocaleDateString(localeOf(lang), { month: 'long', year: 'numeric', numberingSystem: 'latn' } as Intl.DateTimeFormatOptions);

export const fmtMonthShort = (date: Date, lang: AgentLang): string =>
    date.toLocaleDateString(localeOf(lang), { month: 'short' });
