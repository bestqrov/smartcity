// ─── Locale ──────────────────────────────────────────────────────────────────

export type Locale = "ar" | "fr" | "en";

// ─── Direction ───────────────────────────────────────────────────────────────

export type Direction = "rtl" | "ltr";

// ─── Locale Config ───────────────────────────────────────────────────────────

export interface ILocaleConfig {
  locale: Locale;
  direction: Direction;
  label: string;
  flag: string;
}

// ─── Supported Locales ───────────────────────────────────────────────────────

export const SUPPORTED_LOCALES: ILocaleConfig[] = [
  { locale: "ar", direction: "rtl", label: "العربية", flag: "🇲🇦" },
  { locale: "fr", direction: "ltr", label: "Français", flag: "🇫🇷" },
  { locale: "en", direction: "ltr", label: "English", flag: "🇬🇧" },
];

export const DEFAULT_LOCALE: Locale = "ar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getLocaleConfig(locale: Locale): ILocaleConfig {
  const config = SUPPORTED_LOCALES.find((l) => l.locale === locale);
  if (!config) {
    throw new Error(`Unsupported locale: ${locale}`);
  }
  return config;
}

export function getDirection(locale: Locale): Direction {
  return getLocaleConfig(locale).direction;
}

export function isRTL(locale: Locale): boolean {
  return getDirection(locale) === "rtl";
}
