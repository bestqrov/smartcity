export interface TimeSlot {
    day: string;
    startTime: string;
    endTime: string;
}

const GRACE_PERIOD_MINUTES = 5;

// Indexed like Date#getDay() (0 = Sunday). Kept for callers that print English day names.
export const WEEKDAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

// The groups page stores French day names ("Lundi"), older/seeded data uses English
// ("Monday"). Accept both — and Arabic — so every center's timetable is understood.
const DAY_ALIASES: Record<string, number> = {
    sunday: 0, dimanche: 0, 'الأحد': 0, 'الاحد': 0,
    monday: 1, lundi: 1, 'الإثنين': 1, 'الاثنين': 1,
    tuesday: 2, mardi: 2, 'الثلاثاء': 2,
    wednesday: 3, mercredi: 3, 'الأربعاء': 3, 'الاربعاء': 3,
    thursday: 4, jeudi: 4, 'الخميس': 4,
    friday: 5, vendredi: 5, 'الجمعة': 5,
    saturday: 6, samedi: 6, 'السبت': 6,
};

/** Day name in any supported language → Date#getDay() index, or null when unknown. */
export const dayIndexOf = (day: string | undefined | null): number | null => {
    if (!day) return null;
    const index = DAY_ALIASES[day.trim().toLowerCase()];
    return index === undefined ? null : index;
};

export const parseTimeOnDate = (date: Date, hhmm: string): Date => {
    const [hours, minutes] = hhmm.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
};

/** Local midnight of the given instant — the value stored in Attendance.date. */
export const startOfDay = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** "YYYY-MM-DD" of a local date. */
export const toDateKey = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** "YYYY-MM-DD" → local midnight, or null when malformed. */
export const parseDateKey = (key: string | undefined | null): Date | null => {
    if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return toDateKey(date) === key ? date : null;
};

/** The group's sessions that fall on the given date, earliest first. */
export const slotsOnDate = (timeSlots: TimeSlot[] | null | undefined, date: Date): TimeSlot[] =>
    (timeSlots || [])
        .filter((slot) => slot && slot.startTime && dayIndexOf(slot.day) === date.getDay())
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

/**
 * For a QR scan: picks the session of the day whose start is closest to the scan time and
 * says whether the student is on time (within the grace period) or late.
 */
export const resolveScanSession = (
    timeSlots: TimeSlot[],
    scannedAt: Date
): { slot: TimeSlot; status: 'PRESENT' | 'LATE' } => {
    const todaySlots = slotsOnDate(timeSlots, scannedAt);

    if (todaySlots.length === 0) {
        throw new Error('No scheduled session for this group today');
    }

    let slot = todaySlots[0];
    let closestDiff = Math.abs(scannedAt.getTime() - parseTimeOnDate(scannedAt, slot.startTime).getTime());

    for (let i = 1; i < todaySlots.length; i += 1) {
        const diff = Math.abs(scannedAt.getTime() - parseTimeOnDate(scannedAt, todaySlots[i].startTime).getTime());
        if (diff < closestDiff) {
            closestDiff = diff;
            slot = todaySlots[i];
        }
    }

    const graceDeadline = parseTimeOnDate(scannedAt, slot.startTime).getTime() + GRACE_PERIOD_MINUTES * 60_000;

    return { slot, status: scannedAt.getTime() <= graceDeadline ? 'PRESENT' : 'LATE' };
};

export const deriveAttendanceStatus = (timeSlots: TimeSlot[], scannedAt: Date): 'PRESENT' | 'LATE' =>
    resolveScanSession(timeSlots, scannedAt).status;

interface HolidayRange {
    title: string;
    startDate: Date;
    endDate: Date;
}

/**
 * Holidays are entered as calendar dates and stored at UTC midnight (new Date("YYYY-MM-DD")),
 * so compare on their UTC calendar day against the local day being checked.
 */
export const holidayOn = <H extends HolidayRange>(holidays: H[], date: Date): H | null => {
    const key = toDateKey(date);
    return (
        holidays.find(
            (h) => h.startDate.toISOString().slice(0, 10) <= key && key <= h.endDate.toISOString().slice(0, 10)
        ) || null
    );
};

// Opening hours a session can be scheduled in — covers day schools through evening classes.
export const DAY_START = '08:00';
export const DAY_END = '23:30';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validates a group's timetable: known day names, HH:MM times between DAY_START and DAY_END,
 * end after start, and no two sessions of the group overlapping on the same day (a student
 * can't be in two of them at once). Returns a French message for the first problem, or null.
 */
export const timetableError = (timeSlots: unknown): string | null => {
    if (timeSlots == null) return null;
    if (!Array.isArray(timeSlots)) return "L'emploi du temps est invalide.";

    for (const slot of timeSlots as Partial<TimeSlot>[]) {
        const label = `${slot?.day ?? '?'} ${slot?.startTime ?? '?'}-${slot?.endTime ?? '?'}`;
        if (!slot || dayIndexOf(slot.day) === null) return `Jour inconnu dans la séance ${label}.`;
        if (!HHMM.test(slot.startTime || '') || !HHMM.test(slot.endTime || '')) {
            return `Heure invalide dans la séance ${label}.`;
        }
        if (slot.startTime! < DAY_START || slot.endTime! > DAY_END) {
            return `La séance ${label} doit être entre ${DAY_START} et ${DAY_END}.`;
        }
        if (slot.endTime! <= slot.startTime!) return `La séance ${label} doit finir après son début.`;
    }

    const slots = timeSlots as TimeSlot[];
    for (let i = 0; i < slots.length; i += 1) {
        for (let j = i + 1; j < slots.length; j += 1) {
            const a = slots[i];
            const b = slots[j];
            if (dayIndexOf(a.day) === dayIndexOf(b.day) && a.startTime < b.endTime && b.startTime < a.endTime) {
                return `Les séances ${a.day} ${a.startTime}-${a.endTime} et ${b.startTime}-${b.endTime} se chevauchent.`;
            }
        }
    }

    return null;
};
