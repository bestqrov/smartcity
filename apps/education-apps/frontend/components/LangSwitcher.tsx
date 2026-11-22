'use client';

import { Languages } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';

// FR / ع toggle: each button is labelled in its own language so it can be found whatever the current one.
export default function LangSwitcher({ className = '' }: { className?: string }) {
    const { lang, setLang, tr } = useI18n();
    const option = (value: 'fr' | 'ar', label: string) => (
        <button
            type="button"
            onClick={() => setLang(value)}
            aria-pressed={lang === value}
            lang={value}
            className={`h-7 min-w-[2.25rem] rounded-full px-2 text-xs font-bold transition-colors ${
                lang === value ? 'bg-vib-indigo text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
        >
            {label}
        </button>
    );
    return (
        <div
            role="group"
            aria-label={tr('Langue')}
            dir="ltr"
            className={`flex shrink-0 items-center gap-0.5 rounded-full bg-gray-100 p-1 dark:bg-white/10 ${className}`}
        >
            <Languages size={14} className="mx-1 text-gray-400" aria-hidden="true" />
            {option('fr', 'FR')}
            {option('ar', 'ع')}
        </div>
    );
}
