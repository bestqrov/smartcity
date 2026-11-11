import type { AttendanceStatus } from '@/types';

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'JUSTIFIED'];

// One place for how each status reads and looks, shared by the weekly grid, the scanner,
// the student file and the student/parent portals.
export const ATTENDANCE_META: Record<
    AttendanceStatus,
    { label: string; short: string; cell: string; badge: string; text: string }
> = {
    PRESENT: {
        label: 'Présent',
        short: 'P',
        cell: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
        text: 'text-emerald-600 dark:text-emerald-400',
    },
    LATE: {
        label: 'En retard',
        short: 'R',
        cell: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
        badge: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
        text: 'text-amber-600 dark:text-amber-400',
    },
    ABSENT: {
        label: 'Absent',
        short: 'A',
        cell: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
        badge: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
        text: 'text-red-600 dark:text-red-400',
    },
    JUSTIFIED: {
        label: 'Absence justifiée',
        short: 'J',
        cell: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
        badge: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
        text: 'text-sky-600 dark:text-sky-400',
    },
};

const ERROR_FR: Record<string, string> = {
    'Student not found': 'Élève introuvable dans cette agence.',
    'Group not found': 'Groupe introuvable.',
    'Student is not enrolled in this group': "Cet élève n'est pas inscrit dans ce groupe.",
    'No scheduled session for this group today': "Ce groupe n'a pas de séance aujourd'hui (voir l'emploi du temps du groupe).",
    'Attendance already marked for this session': 'Présence déjà enregistrée pour cette séance.',
    'This group has no session at this time on that day': "Ce groupe n'a pas de séance à cette heure ce jour-là.",
    'This day is a holiday': 'Ce jour est un jour de vacances.',
    'This session has not started yet': "Cette séance n'a pas encore commencé (seule une absence justifiée peut être saisie à l'avance).",
    'This session was just updated by someone else, reload and try again':
        "Cette séance vient d'être modifiée par quelqu'un d'autre. Rechargez la page.",
};

/** The API answers in English; show staff a French sentence. */
export const attendanceErrorMessage = (error: any, fallback: string): string => {
    const raw: string | undefined = error?.response?.data?.error;
    return (raw && ERROR_FR[raw]) || raw || fallback;
};

/** "YYYY-MM-DD" of a local date. */
export const toDateKey = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** "YYYY-MM-DD" → local midnight. */
export const fromDateKey = (key: string): Date => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const formatTime = (iso: string | null | undefined): string =>
    iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
