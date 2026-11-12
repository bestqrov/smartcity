import type { ParentActivity } from '@/types';

/** Parents can answer until the exact deadline (date and time), and never after the start. */
export function answersOpen(a: Pick<ParentActivity, 'startAt' | 'deadline' | 'needsConsent'>, now = new Date()): boolean {
    if (!a.needsConsent) return false;
    if (now.getTime() >= new Date(a.startAt).getTime()) return false;
    if (!a.deadline) return true;
    return now.getTime() <= new Date(a.deadline).getTime();
}

export const upcomingActivities = (list: ParentActivity[] = [], now = new Date()) =>
    list.filter((a) => new Date(a.endAt ?? a.startAt).getTime() >= now.getTime());
