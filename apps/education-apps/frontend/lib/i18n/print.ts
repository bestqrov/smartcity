// Printed documents opened in a new window (thermal receipts) follow the staff space's language.
import { appLang } from './I18nProvider';

/** Attributes for the <html> tag of a printed document: Arabic prints right-to-left. */
export const printHtmlAttrs = (): string => (appLang() === 'ar' ? 'lang="ar" dir="rtl"' : 'lang="fr" dir="ltr"');

/** Font for a printed receipt: monospace reads well in French; Arabic needs a font with Arabic letters. */
export const printFont = (): string =>
    appLang() === 'ar' ? "Tahoma, 'Segoe UI', 'Arial', sans-serif" : 'monospace';
