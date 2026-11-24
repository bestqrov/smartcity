// A Moroccan school year runs from September to August; tuition is due September to June.
const ym = (year: number, month1: number) => `${year}-${String(month1).padStart(2, '0')}`;

const moroccoFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit' });

/** Year and month (1-12) in Morocco (Africa/Casablanca), whatever the server time zone. */
const moroccoYearMonth = (now: Date) => {
    const parts = moroccoFormat.formatToParts(now);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return { year: get('year'), month: get('month') };
};

export const currentSchoolYear = (now = new Date()): string => {
    const { year, month } = moroccoYearMonth(now);
    const start = month >= 9 ? year : year - 1;
    return `${start}/${start + 1}`;
};

export const isSchoolYear = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const m = value.match(/^(\d{4})\/(\d{4})$/);
    return !!m && Number(m[2]) === Number(m[1]) + 1;
};

export const isMonthKey = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** July and August are holidays: no tuition. */
export const isDueMonth = (month: string): boolean => isMonthKey(month) && !['07', '08'].includes(month.slice(5, 7));

/** Month of the first tuition fee for an inscription made on `now`. */
export const startMonthFor = (now = new Date()): string => {
    const { year, month } = moroccoYearMonth(now);
    if (month === 7 || month === 8) return ym(year, 9);
    return ym(year, month);
};
