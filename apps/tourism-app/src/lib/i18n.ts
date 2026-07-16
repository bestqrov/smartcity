'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { en, fr, ar } from '@smartcity/i18n';

const translations: Record<string, Record<string, any>> = { en, fr, ar };

export function useTranslation() {
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const [translateFn, setTranslateFn] = useState(() => (key: string, params?: Record<string, string | number>) =>
    getTranslationValue(locale, key, params),
  );

  useEffect(() => {
    setTranslateFn(() => (key: string, params?: Record<string, string | number>) => getTranslationValue(locale, key, params));
  }, [locale]);

  const t = (key: string, params?: Record<string, string | number>): string => translateFn(key, params);

  return { t, locale };
}

function getTranslationValue(locale: string, key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations[locale] || translations.fr;

  for (const k of keys) {
    if (value == null) return key;
    value = value[k];
  }

  if (typeof value !== 'string') return key;

  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? `{{${k}}}`));
  }

  return value;
}
