// A Moroccan school year runs from September to August; tuition is due September to June.
const ym = (year: number, month1: number) => `${year}-${String(month1).padStart(2, '0')}`;

export const currentSchoolYear = (now = new Date()): string => {
    const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1; // getMonth: 8 = September
    return `${start}/${start + 1}`;
};

export const isSchoolYear = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const m = value.match(/^(\d{4})\/(\d{4})$/);
    return !!m && Number(m[2]) === Number(m[1]) + 1;
};

export const isMonthKey = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** July and August are holidays: no tuition. */
export const isDueMonth = (month: string): boolean => !['07', '08'].includes(month.slice(5, 7));

/** Month of the first tuition fee for an inscription made on `now`. */
export const startMonthFor = (now = new Date()): string => {
    const month = now.getMonth() + 1;
    if (month === 7 || month === 8) return ym(now.getFullYear(), 9);
    return ym(now.getFullYear(), month);
};
