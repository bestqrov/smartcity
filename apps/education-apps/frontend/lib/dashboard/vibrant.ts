// Shared helpers for the Vibrant school dashboards (admin / owner / secretary). French only.
import { fmtMAD, fmtMADShort, fmtNumber } from '@/lib/agent/format';

export const mad = (v: number) => fmtMAD(v, 'fr');
export const madShort = (v: number) => fmtMADShort(v, 'fr');
export const num = (v: number) => fmtNumber(v, 'fr');
export const pct = (p: number) => `${p} %`;

export interface MonthBucket {
    key: string; // YYYY-MM
    label: string; // short month
    title: string; // month + year
    start: Date;
}

/** The last `count` months, oldest first, ending with the current month. */
export function lastMonths(count = 12, now = new Date()): MonthBucket[] {
    return Array.from({ length: count }, (_, i) => {
        const start = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
        return {
            key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
            label: start.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
            title: start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            start,
        };
    });
}

export const monthKey = (value: string | Date | undefined | null): string | null => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Sums `value(row)` per month over the given buckets. */
export function sumByMonth<T>(rows: T[], buckets: MonthBucket[], date: (row: T) => string | undefined, value: (row: T) => number) {
    const totals = new Map(buckets.map((b) => [b.key, 0]));
    for (const row of rows) {
        const key = monthKey(date(row));
        if (key && totals.has(key)) totals.set(key, (totals.get(key) || 0) + (Number(value(row)) || 0));
    }
    return buckets.map((b) => ({ key: b.key, label: b.label, title: b.title, value: totals.get(b.key) || 0 }));
}

/** Top `max - 1` categories by count, the rest folded into "Autres". */
export function topCategories(labels: string[], max = 6) {
    const counts = new Map<string, number>();
    for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const head = sorted.length > max ? sorted.slice(0, max - 1) : sorted;
    const rest = sorted.length > max ? sorted.slice(max - 1).reduce((s, [, n]) => s + n, 0) : 0;
    const rows = head.map(([label, value], i) => ({ key: label, label, value, tone: i }));
    if (rest > 0) rows.push({ key: '__autres', label: 'Autres', value: rest, tone: rows.length });
    return rows;
}

export const greeting = (now = new Date()) => (now.getHours() < 18 ? 'Bonjour' : 'Bonsoir');

export const todayLabel = (now = new Date()) =>
    now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
