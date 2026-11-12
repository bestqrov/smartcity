/** Day/month for notification texts, in the schools' timezone (Morocco), always with latin digits. */
const FORMATTERS = {
    fr: new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Casablanca', day: '2-digit', month: '2-digit' }),
    ar: new Intl.DateTimeFormat('ar-MA-u-nu-latn', { timeZone: 'Africa/Casablanca', day: '2-digit', month: '2-digit' }),
};

export const formatDayMonth = (d: Date | string, locale: 'fr' | 'ar' = 'fr'): string => {
    const parts = FORMATTERS[locale].formatToParts(new Date(d));
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    return `${day}/${month}`;
};
