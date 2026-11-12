import type { Student, StudentGroupSummary } from '@/types';
import type { ParentLang } from './messages';

// timeSlots store French day names (same values as the groups screens and the student portal).
export const DAY_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
// JS getDay(): 0 = Sunday
const JS_DAY_TO_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const studentOwed = (s: Student) => sum((s.inscriptions || []).map((i) => i.amount));
export const studentPaid = (s: Student) => sum((s.payments || []).map((p) => p.amount));
/** Balance as on the former parent page: sum of inscriptions − sum of tuition payments. */
export const studentBalance = (s: Student) => studentOwed(s) - studentPaid(s);

const locale = (lang: ParentLang) => (lang === 'ar' ? 'ar-MA' : 'fr-FR');

export const formatMoney = (amount: number, currency: string) =>
    `${amount.toLocaleString('fr-FR')} ${currency}`;

export const formatDate = (iso: string, lang: ParentLang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
    new Date(iso).toLocaleDateString(locale(lang), { numberingSystem: 'latn', ...opts } as Intl.DateTimeFormatOptions);

export const isSameLocalDay = (iso: string, d: Date) => new Date(iso).toDateString() === d.toDateString();

export const initials = (name: string, surname?: string) =>
    `${(name || '').trim().charAt(0)}${(surname || '').trim().charAt(0)}`.toUpperCase() || '?';

export interface ScheduledSlot {
    day: string;
    startTime: string;
    endTime: string;
    group: StudentGroupSummary;
}

export const allSlots = (groups: StudentGroupSummary[] = []): ScheduledSlot[] =>
    groups
        .flatMap((group) => (group.timeSlots || []).map((slot) => ({ ...slot, group })))
        .filter((s) => DAY_ORDER.includes(s.day))
        .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime));

/** The next session that hasn't started yet, looking up to one week ahead. */
export const nextSession = (groups: StudentGroupSummary[] = [], now = new Date()): (ScheduledSlot & { date: Date }) | null => {
    const slots = allSlots(groups);
    let best: (ScheduledSlot & { date: Date }) | null = null;
    for (const slot of slots) {
        const [h, m] = slot.startTime.split(':').map(Number);
        for (let offset = 0; offset <= 7; offset++) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, h || 0, m || 0);
            if (JS_DAY_TO_FR[d.getDay()] !== slot.day || d <= now) continue;
            if (!best || d < best.date) best = { ...slot, date: d };
            break;
        }
    }
    return best;
};
