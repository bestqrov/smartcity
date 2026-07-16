export interface LocaleConfig {
  locale: string;
  direction: 'ltr' | 'rtl';
  label: string;
  flag: string;
}

export const locales: LocaleConfig[] = [
  { locale: 'ar', direction: 'rtl', label: 'العربية', flag: '🇲🇦' },
  { locale: 'fr', direction: 'ltr', label: 'Français', flag: '🇫🇷' },
  { locale: 'en', direction: 'ltr', label: 'English', flag: '🇬🇧' },
];

export const defaultLocale = 'fr';

export const supportedLocales = locales.map((l) => l.locale);

/**
 * Returns the text direction ('ltr' or 'rtl') for a given locale.
 */
export function getDirection(locale: string): 'ltr' | 'rtl' {
  const config = locales.find((l) => l.locale === locale);
  return config?.direction ?? 'ltr';
}

/**
 * Returns the full locale configuration for a given locale code.
 */
export function getLocaleConfig(locale: string): LocaleConfig | undefined {
  return locales.find((l) => l.locale === locale);
}

/**
 * Returns true if the given locale uses right-to-left text direction.
 */
export function isRTL(locale: string): boolean {
  return getDirection(locale) === 'rtl';
}

// Re-export locale JSON files
export { default as en } from './locales/en.json';
export { default as fr } from './locales/fr.json';
export { default as ar } from './locales/ar.json';
