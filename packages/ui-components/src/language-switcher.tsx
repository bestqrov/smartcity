'use client';

import React, { useState, useRef, useEffect, type HTMLAttributes } from 'react';

type Locale = 'ar' | 'fr' | 'en';

interface LocaleOption {
  code: Locale;
  label: string;
  flag: string;
}

const LOCALES: LocaleOption[] = [
  { code: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag: '\uD83C\uDDE9\uD83C\uDDFF' },
  { code: 'fr', label: 'Fran\u00E7ais', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'en', label: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
];

export interface LanguageSwitcherProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Currently active locale */
  currentLocale: Locale;
  /** Fired when the user picks a different locale */
  onLocaleChange: (locale: Locale) => void;
  /** Compact mode shows only the flag; expanded shows flag + label */
  compact?: boolean;
}

export function LanguageSwitcher({
  currentLocale,
  onLocaleChange,
  compact = false,
  className = '',
  ...rest
}: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === currentLocale) ?? LOCALES[2];

  /* ── Close on outside click ──────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── Close on Escape ─────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} {...rest}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium',
          'transition-colors hover:bg-gray-50',
          'dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <span aria-hidden="true">{current.flag}</span>
        {!compact && <span>{current.label}</span>}
        <ChevronIcon open={open} />
      </button>

      {/* Dropdown */}
      {open && (
        <ul
          role="listbox"
          aria-label="Available languages"
          className={[
            'absolute z-50 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg',
            'dark:bg-gray-900 dark:border-gray-700',
            'animate-in fade-in slide-in-from-top-2 duration-150',
            // Align end for RTL-aware positioning
            'end-0',
          ].join(' ')}
        >
          {LOCALES.map((locale) => {
            const isActive = locale.code === currentLocale;
            return (
              <li
                key={locale.code}
                role="option"
                aria-selected={isActive}
                className={[
                  'flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800',
                ].join(' ')}
                onClick={() => {
                  onLocaleChange(locale.code);
                  setOpen(false);
                }}
              >
                <span aria-hidden="true" className="text-lg">
                  {locale.flag}
                </span>
                <span>{locale.label}</span>
                {isActive && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="ms-auto h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Chevron icon ──────────────────────────────────────── */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`h-4 w-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
