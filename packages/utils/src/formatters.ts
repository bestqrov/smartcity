/**
 * Formats a numeric amount as a localized currency string.
 */
export function formatCurrency(
  amount: number,
  currency: string = 'MAD',
  locale: string = 'fr-MA'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type DateFormatStyle = 'short' | 'medium' | 'long' | 'full';

/**
 * Formats a Date object or ISO string into a localized date string.
 */
export function formatDate(
  date: Date | string,
  locale: string = 'fr',
  format: DateFormatStyle = 'medium'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const styleMap: Record<DateFormatStyle, Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    full: {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    },
  };

  return new Intl.DateTimeFormat(locale, styleMap[format]).format(d);
}

/**
 * Returns a human-readable relative time string (e.g. "3 hours ago").
 */
export function formatRelativeTime(
  date: Date | string,
  locale: string = 'fr'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffWeek = Math.round(diffDay / 7);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, 'hour');
  if (Math.abs(diffDay) < 7) return rtf.format(-diffDay, 'day');
  if (Math.abs(diffWeek) < 5) return rtf.format(-diffWeek, 'week');
  if (Math.abs(diffMonth) < 12) return rtf.format(-diffMonth, 'month');
  return rtf.format(-diffYear, 'year');
}

/**
 * Generates a URL-safe slug from arbitrary text.
 * Handles French/Arabic diacritics by stripping combining marks.
 */
export function generateSlug(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[\u0600-\u06FF]+/g, '') // strip Arabic characters
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Truncates text to a maximum length, appending an ellipsis if truncated.
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length).trimEnd() + suffix;
}

/**
 * Encodes an object payload as a base64-encoded JSON string,
 * suitable for embedding in a QR code.
 */
export function generateQRData(payload: object): string {
  const json = JSON.stringify(payload);
  if (typeof btoa === 'function') {
    return btoa(unescape(encodeURIComponent(json)));
  }
  // Node.js fallback
  return Buffer.from(json, 'utf-8').toString('base64');
}

/**
 * Decodes a base64-encoded JSON string back into an object.
 */
export function parseQRData<T = Record<string, unknown>>(data: string): T {
  let json: string;
  if (typeof atob === 'function') {
    json = decodeURIComponent(escape(atob(data)));
  } else {
    // Node.js fallback
    json = Buffer.from(data, 'base64').toString('utf-8');
  }
  return JSON.parse(json) as T;
}
