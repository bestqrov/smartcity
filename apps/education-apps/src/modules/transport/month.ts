const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isValidMonth = (value: unknown): value is string =>
    typeof value === 'string' && MONTH_RE.test(value);

export const currentMonth = (now: Date = new Date()): string =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// "2026-09" -> 2026-10-01 00:00 (local). Used as an exclusive upper bound.
export const startOfNextMonth = (month: string): Date => {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Date(year, monthNumber, 1);
};
