import { useCallback, useEffect, useState } from 'react';
import type { ParentHomework } from '@/types';

export type HwBucket = 'today' | 'tomorrow' | 'week' | 'later' | 'past';
export const HW_BUCKETS: HwBucket[] = ['today', 'tomorrow', 'week', 'later', 'past'];

/** Local YYYY-MM-DD for a Date. */
export const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
};

/** Due dates are calendar days: the date part is compared, never the time. */
export const dueKey = (h: Pick<ParentHomework, 'dueDate'>) => h.dueDate.slice(0, 10);

export function bucketOf(key: string, now = new Date()): HwBucket | null {
    const today = dayKey(now);
    if (key === today) return 'today';
    if (key === dayKey(addDays(now, 1))) return 'tomorrow';
    if (key > today) {
        // End of the current week (Sunday).
        const toSunday = (7 - now.getDay()) % 7;
        return key <= dayKey(addDays(now, toSunday)) ? 'week' : 'later';
    }
    return key >= dayKey(addDays(now, -7)) ? 'past' : null;
}

export function groupHomework(list: ParentHomework[], now = new Date()) {
    const out: Record<HwBucket, ParentHomework[]> = { today: [], tomorrow: [], week: [], later: [], past: [] };
    for (const h of list) {
        const b = bucketOf(dueKey(h), now);
        if (b) out[b].push(h);
    }
    for (const b of HW_BUCKETS) out[b].sort((a, c) => (b === 'past' ? dueKey(c).localeCompare(dueKey(a)) : dueKey(a).localeCompare(dueKey(c))));
    return out;
}

export const parseDueDate = (h: Pick<ParentHomework, 'dueDate'>) => `${dueKey(h)}T12:00:00`;

const KEY = 'parent-hw-done';

/** "Done" ticks are local to this phone only. */
export function useHomeworkDone() {
    const [done, setDone] = useState<string[]>([]);
    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed)) setDone(parsed.filter((x) => typeof x === 'string'));
        } catch {
            /* storage unavailable */
        }
    }, []);
    const toggle = useCallback((id: string) => {
        setDone((prev) => {
            const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-500);
            try {
                window.localStorage.setItem(KEY, JSON.stringify(next));
            } catch {
                /* storage unavailable */
            }
            return next;
        });
    }, []);
    return { done, toggle };
}
