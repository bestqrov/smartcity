'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    CalendarDays,
    CheckCheck,
    ChevronLeft,
    ChevronRight,
    Clock3,
    LayoutGrid,
    PenLine,
    Printer,
    QrCode,
    ScanLine,
    Table2,
    X,
} from 'lucide-react';
import { groupsService } from '@/lib/services/groups';
import { getWeeklyAttendance, markSessionAttendance } from '@/lib/services/attendance';
import {
    ATTENDANCE_META,
    ATTENDANCE_STATUSES,
    attendanceErrorMessage,
    formatTime,
    fromDateKey,
    toDateKey,
} from '@/lib/attendanceStatus';
import type { AttendanceStatus, WeeklyAttendance, WeeklyAttendanceRecord } from '@/types';

import { appLocale, useI18n } from '@/lib/i18n/I18nProvider';
// Same window groups can be scheduled in (see groups page / API timetable validation).
const DAY_START_MIN = 8 * 60; // 08:00
const DAY_END_MIN = 23 * 60 + 30; // 23:30
const ROW_MIN = 30;
const ROW_PX = 26;
const ROWS = (DAY_END_MIN - DAY_START_MIN) / ROW_MIN;

const GROUP_STORAGE_KEY = 'presence:lastGroupId';
const VIEW_STORAGE_KEY = 'presence:view';

interface GroupOption {
    id: string;
    name: string;
}

interface Session {
    date: string;
    startTime: string;
    endTime: string;
    holiday: string | null;
}

type View = 'timetable' | 'recap';

interface RollEntry {
    status: AttendanceStatus | null;
    note: string;
}

const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

const addDays = (key: string, days: number) => {
    const d = fromDateKey(key);
    d.setDate(d.getDate() + days);
    return toDateKey(d);
};

const shortDay = (key: string) =>
    fromDateKey(key).toLocaleDateString(appLocale(), { weekday: 'short', day: '2-digit', month: '2-digit' });

const longDay = (key: string) =>
    fromDateKey(key).toLocaleDateString(appLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

const sessionStartDate = (s: Session) => {
    const d = fromDateKey(s.date);
    d.setMinutes(toMinutes(s.startTime));
    return d;
};

const sessionKey = (s: { date: string; startTime: string }) => `${s.date}|${s.startTime}`;
const recordKey = (studentId: string, date: string, slotStart: string | null) => `${studentId}|${date}|${slotStart}`;

const SOURCE_LABEL: Record<WeeklyAttendanceRecord['source'], string> = {
    SCAN: 'scan QR',
    MANUAL: 'saisie manuelle',
    AUTO: 'absence automatique',
};

const readStorage = (key: string) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const writeStorage = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // private mode — the choice just isn't remembered
    }
};

export default function PresencePage() {
    const { tr } = useI18n();
    // Mounted under /admin and /secretary: keep links inside the current space.
    const isSecretary = (usePathname() || '').startsWith('/secretary');
    const base = isSecretary ? '/secretary' : '/admin';
    const [groups, setGroups] = useState<GroupOption[]>([]);
    const [groupId, setGroupId] = useState('');
    const [weekOf, setWeekOf] = useState(() => toDateKey(new Date()));
    const [view, setView] = useState<View>('timetable');
    const [week, setWeek] = useState<WeeklyAttendance | null>(null);
    const [loadingGroups, setLoadingGroups] = useState(true);
    const [loadingWeek, setLoadingWeek] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [now, setNow] = useState(() => new Date());
    const [rollSession, setRollSession] = useState<Session | null>(null);

    useEffect(() => {
        if (readStorage(VIEW_STORAGE_KEY) === 'recap') setView('recap');
        groupsService
            .getAll()
            .then((data: GroupOption[]) => {
                const sorted = [...(data || [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
                setGroups(sorted);
                const remembered = readStorage(GROUP_STORAGE_KEY);
                const initial = sorted.find((g) => g.id === remembered) || sorted[0];
                if (initial) setGroupId(initial.id);
            })
            .catch(() => setGroups([]))
            .finally(() => setLoadingGroups(false));
    }, []);

    // Keeps "upcoming session" states right when the page stays open all day.
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(timer);
    }, []);

    const loadWeek = useCallback(async () => {
        if (!groupId) return;
        setLoadingWeek(true);
        setLoadError(null);
        try {
            setWeek(await getWeeklyAttendance(groupId, weekOf));
        } catch (error) {
            setWeek(null);
            setLoadError(tr(attendanceErrorMessage(error, 'Impossible de charger la présence de ce groupe.')));
        } finally {
            setLoadingWeek(false);
        }
    }, [groupId, weekOf]);

    useEffect(() => {
        loadWeek();
    }, [loadWeek]);

    const sessions: Session[] = useMemo(
        () =>
            (week?.days || []).flatMap((day) =>
                day.slots.map((slot) => ({ date: day.date, holiday: day.holiday, ...slot }))
            ),
        [week]
    );

    const recordsByKey = useMemo(() => {
        const map = new Map<string, WeeklyAttendanceRecord>();
        (week?.records || []).forEach((r) => map.set(recordKey(r.studentId, r.date, r.slotStart), r));
        return map;
    }, [week]);

    const isUpcoming = useCallback((s: Session) => sessionStartDate(s) > now, [now]);

    const sessionStats = useCallback(
        (s: Session) => {
            let present = 0;
            let marked = 0;
            (week?.students || []).forEach((st) => {
                const r = recordsByKey.get(recordKey(st.id, s.date, s.startTime));
                if (!r) return;
                marked += 1;
                if (r.status === 'PRESENT' || r.status === 'LATE') present += 1;
            });
            return { present, marked, total: week?.students.length || 0 };
        },
        [week, recordsByKey]
    );

    const selectGroup = (id: string) => {
        setGroupId(id);
        writeStorage(GROUP_STORAGE_KEY, id);
    };

    const selectView = (v: View) => {
        setView(v);
        writeStorage(VIEW_STORAGE_KEY, v);
    };

    const applySaved = (saved: WeeklyAttendanceRecord[]) => {
        setWeek((prev) => {
            if (!prev) return prev;
            const replaced = new Set(saved.map((r) => recordKey(r.studentId, r.date, r.slotStart)));
            return {
                ...prev,
                records: [...prev.records.filter((r) => !replaced.has(recordKey(r.studentId, r.date, r.slotStart))), ...saved],
            };
        });
    };

    const weekStart = week?.weekStart || weekOf;
    const weekEnd = addDays(weekStart, 6);
    const todayKey = toDateKey(now);
    const isCurrentWeek = todayKey >= weekStart && todayKey <= weekEnd;
    const weekTitle = tr('Semaine du {from} au {to}', {
        from: fromDateKey(weekStart).toLocaleDateString(appLocale(), { day: 'numeric', month: 'long' }),
        to: fromDateKey(weekEnd).toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', year: 'numeric' }),
    });

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tr("Présence de la semaine")}</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{tr("Les séances viennent de l'emploi du temps du groupe. Cliquez sur une séance pour faire l'appel.")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`${base}/attendance/scan`}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                        <QrCode size={18} />{tr("Scanner QR")}</Link>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        disabled={!week}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                        <Printer size={18} />{tr("Imprimer")}</button>
                </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col gap-3 xl:flex-row xl:items-center print:hidden">
                <select
                    aria-label={tr("Groupe")}
                    className="w-full xl:max-w-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={groupId}
                    onChange={(e) => selectGroup(e.target.value)}
                    disabled={loadingGroups || groups.length === 0}
                >
                    {groups.length === 0 && <option value="">{loadingGroups ? tr("Chargement…") : tr("Aucun groupe")}</option>}
                    {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.name}
                        </option>
                    ))}
                </select>

                <div className="inline-flex self-start rounded-xl border border-slate-300 dark:border-slate-600 p-1" role="tablist" aria-label={tr("Affichage")}>
                    {([
                        ['timetable', tr('Emploi du temps'), LayoutGrid],
                        ['recap', tr('Récap par élève'), Table2],
                    ] as const).map(([key, label, Icon]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={view === key}
                            onClick={() => selectView(key)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                                view === key
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                            <Icon size={16} /> {label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 xl:ms-auto">
                    <IconButton label={tr("Semaine précédente")} onClick={() => setWeekOf(addDays(weekStart, -7))}>
                        <ChevronLeft size={18} />
                    </IconButton>
                    <span className="min-w-0 flex-1 text-center text-sm font-medium text-slate-700 dark:text-slate-200 xl:min-w-[18rem]">
                        {weekTitle}
                    </span>
                    <IconButton label={tr("Semaine suivante")} onClick={() => setWeekOf(addDays(weekStart, 7))}>
                        <ChevronRight size={18} />
                    </IconButton>
                    {!isCurrentWeek && (
                        <button
                            type="button"
                            onClick={() => setWeekOf(toDateKey(new Date()))}
                            className="rounded-xl px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                        >{tr("Aujourd'hui")}</button>
                    )}
                </div>
            </div>

            {!loadingGroups && groups.length === 0 && (
                <EmptyState icon={<CalendarDays size={40} />} title={tr("Aucun groupe")}>{tr("Créez d'abord un groupe avec son emploi du temps dans")}{' '}
                    {isSecretary ? <>{tr("Groupes (par l'administrateur)")}</> : <Link className="text-blue-600 underline" href="/admin/groups">{tr("Groupes")}</Link>}.
                </EmptyState>
            )}

            {loadError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    {tr(loadError)}
                </div>
            )}

            {week && (
                <div className={`rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden print:border-0 print:shadow-none ${loadingWeek ? 'opacity-60' : ''}`}>
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-bold text-slate-900 dark:text-white">{week.group.name}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {[
                                week.group.teacherName && tr('Enseignant : {name}', { name: week.group.teacherName }),
                                week.group.room && tr('Salle : {room}', { room: week.group.room }),
                                tr('{n} élève(s)', { n: week.students.length }),
                                tr('{n} séance(s) cette semaine', { n: sessions.length }),
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                            <span className="hidden print:inline"> · {weekTitle}</span>
                        </p>
                    </div>

                    {sessions.length === 0 ? (
                        <EmptyState icon={<Clock3 size={40} />} title={tr("Pas de séance cette semaine")} bare>{tr("Ce groupe n'a aucune séance dans son emploi du temps. Ajoutez ses jours et heures (entre 08:00 et 23:30) dans")}{' '}
                            {isSecretary ? <>{tr("Groupes (par l'administrateur)")}</> : <Link className="text-blue-600 underline" href="/admin/groups">{tr("Groupes")}</Link>}.
                        </EmptyState>
                    ) : view === 'timetable' ? (
                        <Timetable
                            week={week}
                            todayKey={todayKey}
                            now={now}
                            isUpcoming={isUpcoming}
                            sessionStats={sessionStats}
                            onOpen={setRollSession}
                        />
                    ) : (
                        <Recap
                            week={week}
                            sessions={sessions}
                            recordsByKey={recordsByKey}
                            todayKey={todayKey}
                            isUpcoming={isUpcoming}
                            sessionStats={sessionStats}
                            onOpen={setRollSession}
                            studentHref={isSecretary ? null : (id) => `/admin/students/${id}`}
                        />
                    )}
                </div>
            )}

            {week && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {ATTENDANCE_STATUSES.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1.5">
                            <StatusChip status={s} /> {tr(ATTENDANCE_META[s].label)}
                        </span>
                    ))}
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-4 w-6 rounded hatched border border-slate-200 dark:border-slate-700" />{tr("Pas de séance pour ce groupe")}</span>
                </div>
            )}

            {rollSession && week && (
                <RollCallDialog
                    week={week}
                    session={rollSession}
                    recordsByKey={recordsByKey}
                    upcoming={isUpcoming(rollSession)}
                    onClose={() => setRollSession(null)}
                    onSaved={(saved) => {
                        applySaved(saved);
                        setRollSession(null);
                    }}
                />
            )}

            <style jsx global>{`
                .hatched {
                    background-image: repeating-linear-gradient(
                        45deg,
                        rgba(148, 163, 184, 0.14) 0,
                        rgba(148, 163, 184, 0.14) 4px,
                        transparent 4px,
                        transparent 9px
                    );
                }
                @media print {
                    @page {
                        size: landscape;
                        margin: 1cm;
                    }
                    body * {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}

/* ---------------------------------------------------------------- timetable view */

function Timetable({
    week,
    todayKey,
    now,
    isUpcoming,
    sessionStats,
    onOpen,
}: {
    week: WeeklyAttendance;
    todayKey: string;
    now: Date;
    isUpcoming: (s: Session) => boolean;
    sessionStats: (s: Session) => { present: number; marked: number; total: number };
    onOpen: (s: Session) => void;
}) {
    const { tr } = useI18n();
    const hours = Array.from({ length: Math.ceil(ROWS / 2) }, (_, i) => DAY_START_MIN + i * 60);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const height = ROWS * ROW_PX;

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[760px]">
                <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
                    <div className="sticky start-0 z-10 bg-slate-50 dark:bg-slate-900" />
                    {week.days.map((day) => (
                        <div
                            key={day.date}
                            className={`border-s border-slate-200 dark:border-slate-700 px-2 py-2 text-center text-sm font-semibold capitalize ${
                                day.date === todayKey ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'
                            }`}
                        >
                            {shortDay(day.date)}
                            <span className="block text-[11px] font-normal normal-case text-slate-500 dark:text-slate-400 truncate">
                                {day.holiday ? `🏖 ${day.holiday}` : tr("{length} séance(s)", { length: day.slots.length })}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
                    <div className="sticky start-0 z-10 bg-white dark:bg-slate-800" style={{ height }}>
                        {hours.map((m) => (
                            <span
                                key={m}
                                className="absolute end-2 -translate-y-1/2 text-[11px] text-slate-400 first:translate-y-0"
                                style={{ top: ((m - DAY_START_MIN) / ROW_MIN) * ROW_PX }}
                            >
                                {String(Math.floor(m / 60)).padStart(2, '0')}:00
                            </span>
                        ))}
                    </div>

                    {week.days.map((day) => (
                        <div key={day.date} className="relative hatched border-s border-slate-200 dark:border-slate-700" style={{ height }}>
                            {Array.from({ length: ROWS }, (_, i) => (
                                <div
                                    key={i}
                                    className={`absolute inset-x-0 border-t ${i % 2 === 0 ? 'border-slate-200 dark:border-slate-700' : 'border-slate-100 dark:border-slate-700/40'}`}
                                    style={{ top: i * ROW_PX }}
                                />
                            ))}

                            {day.date === todayKey && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN && (
                                <div className="absolute inset-x-0 z-20 h-0.5 bg-red-500" style={{ top: ((nowMin - DAY_START_MIN) / ROW_MIN) * ROW_PX }}>
                                    <span className="absolute -start-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                                </div>
                            )}

                            {day.slots.map((slot) => {
                                const session: Session = { date: day.date, holiday: day.holiday, ...slot };
                                const start = Math.max(toMinutes(slot.startTime), DAY_START_MIN);
                                const end = Math.min(toMinutes(slot.endTime), DAY_END_MIN);
                                const top = ((start - DAY_START_MIN) / ROW_MIN) * ROW_PX;
                                const blockHeight = Math.max(((end - start) / ROW_MIN) * ROW_PX - 3, 22);
                                const upcoming = isUpcoming(session);
                                const { present, marked, total } = sessionStats(session);
                                const missing = total - marked;

                                let tone: string;
                                let status: string;
                                if (day.holiday) {
                                    tone = 'bg-slate-200 text-slate-500 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600 cursor-not-allowed';
                                    status = 'Vacances';
                                } else if (upcoming) {
                                    tone = 'bg-white text-blue-800 border-blue-300 dark:bg-slate-900 dark:text-blue-300 dark:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/10';
                                    status = 'À venir';
                                } else if (missing > 0) {
                                    tone = 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/40 hover:bg-amber-100';
                                    status = `${present}/${total} présents · ${missing} à saisir`;
                                } else {
                                    tone = 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/40 hover:bg-emerald-100';
                                    status = `${present}/${total} présents`;
                                }

                                return (
                                    <button
                                        key={slot.startTime}
                                        type="button"
                                        disabled={!!day.holiday}
                                        onClick={() => onOpen(session)}
                                        aria-label={`${longDay(day.date)} ${slot.startTime}-${slot.endTime} : ${status}`}
                                        className={`absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-start text-xs shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${tone}`}
                                        style={{ top: top + 1, height: blockHeight }}
                                    >
                                        <span className="block font-bold">
                                            {slot.startTime} – {slot.endTime}
                                        </span>
                                        {blockHeight > 34 && <span className="block truncate">{status}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------- recap view */

function Recap({
    week,
    sessions,
    recordsByKey,
    todayKey,
    isUpcoming,
    sessionStats,
    onOpen,
    studentHref,
}: {
    studentHref: ((id: string) => string) | null;
    week: WeeklyAttendance;
    sessions: Session[];
    recordsByKey: Map<string, WeeklyAttendanceRecord>;
    todayKey: string;
    isUpcoming: (s: Session) => boolean;
    sessionStats: (s: Session) => { present: number; marked: number; total: number };
    onOpen: (s: Session) => void;
}) {
    const { tr } = useI18n();
    const days = week.days.filter((d) => d.slots.length > 0);

    const rate = (studentId: string) => {
        let attended = 0;
        let counted = 0;
        sessions.forEach((s) => {
            if (s.holiday) return;
            const r = recordsByKey.get(recordKey(studentId, s.date, s.startTime));
            if (!r || r.status === 'JUSTIFIED') return;
            counted += 1;
            if (r.status === 'PRESENT' || r.status === 'LATE') attended += 1;
        });
        return counted === 0 ? null : Math.round((attended / counted) * 100);
    };

    if (week.students.length === 0) {
        return <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{tr("Aucun élève inscrit dans ce groupe.")}</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/60">
                        <th rowSpan={2} className="sticky start-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-e border-slate-200 dark:border-slate-700 px-3 py-2 text-start font-semibold text-slate-700 dark:text-slate-200 min-w-[10rem]">{tr("Élève")}</th>
                        {days.map((day) => (
                            <th
                                key={day.date}
                                colSpan={day.slots.length}
                                className={`border-b border-e border-slate-200 dark:border-slate-700 px-2 py-2 text-center font-semibold capitalize ${day.date === todayKey ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}
                            >
                                {shortDay(day.date)}
                                {day.holiday && <span className="block text-[11px] font-normal normal-case text-slate-500">{day.holiday}</span>}
                            </th>
                        ))}
                        <th rowSpan={2} className="border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-200">{tr("Taux")}</th>
                    </tr>
                    <tr className="bg-slate-50 dark:bg-slate-900/60">
                        {sessions.map((s) => (
                            <th key={sessionKey(s)} className="border-b border-e border-slate-200 dark:border-slate-700 p-1 text-center">
                                <button
                                    type="button"
                                    disabled={!!s.holiday}
                                    onClick={() => onOpen(s)}
                                    title={tr("Faire l'appel {startTime} - {endTime}", { startTime: s.startTime, endTime: s.endTime })}
                                    className="rounded-md px-1.5 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-500/10 dark:hover:text-blue-300 disabled:hover:bg-transparent"
                                >
                                    {s.startTime}
                                </button>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {week.students.map((student) => {
                        const name = `${student.name} ${student.surname}`.trim();
                        const r100 = rate(student.id);
                        return (
                            <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30">
                                <td className="sticky start-0 z-10 bg-white dark:bg-slate-800 border-b border-e border-slate-200 dark:border-slate-700 px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                                    {studentHref ? (
                                        <Link href={studentHref(student.id)} className="hover:text-blue-600 dark:hover:text-blue-400">
                                            {name}
                                        </Link>
                                    ) : (
                                        name
                                    )}
                                </td>
                                {sessions.map((s) => {
                                    if (s.holiday) {
                                        return <td key={sessionKey(s)} className="hatched border-b border-e border-slate-200 dark:border-slate-700" title={s.holiday} />;
                                    }
                                    const r = recordsByKey.get(recordKey(student.id, s.date, s.startTime));
                                    const tip = r
                                        ? [tr(ATTENDANCE_META[r.status].label), r.scannedAt && tr('scanné à {time}', { time: formatTime(r.scannedAt) }), r.note && `« ${r.note} »`]
                                              .filter(Boolean)
                                              .join(' — ')
                                        : isUpcoming(s)
                                          ? tr('Séance à venir')
                                          : tr('Pas encore saisi');
                                    return (
                                        <td key={sessionKey(s)} className="border-b border-e border-slate-200 dark:border-slate-700 p-1 text-center">
                                            <button
                                                type="button"
                                                onClick={() => onOpen(s)}
                                                title={tip}
                                                aria-label={`${name}, ${longDay(s.date)} ${s.startTime} : ${tip}`}
                                                className={`relative mx-auto flex h-9 w-full min-w-[2.75rem] flex-col items-center justify-center rounded-lg text-xs font-bold leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 print:h-6 ${
                                                    r
                                                        ? ATTENDANCE_META[r.status].cell
                                                        : isUpcoming(s)
                                                          ? 'text-slate-300 dark:text-slate-600'
                                                          : 'border border-dashed border-slate-300 dark:border-slate-600 text-slate-400'
                                                }`}
                                            >
                                                <span>{r ? ATTENDANCE_META[r.status].short : '·'}</span>
                                                {r?.scannedAt && <span className="text-[10px] font-medium opacity-80">{formatTime(r.scannedAt)}</span>}
                                                {r?.note && <span className="absolute end-1 top-1 h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
                                            </button>
                                        </td>
                                    );
                                })}
                                <td className="border-b border-slate-200 dark:border-slate-700 px-3 py-1.5 text-center font-semibold whitespace-nowrap">
                                    {r100 === null ? (
                                        <span className="text-slate-400">—</span>
                                    ) : (
                                        <span className={r100 >= 90 ? 'text-emerald-600 dark:text-emerald-400' : r100 >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                                            {r100}%
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-900/60">
                        <td className="sticky start-0 z-10 bg-slate-50 dark:bg-slate-900 border-e border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{tr("Présents")}</td>
                        {sessions.map((s) => {
                            const { present, total } = sessionStats(s);
                            return (
                                <td key={sessionKey(s)} className="border-e border-slate-200 dark:border-slate-700 px-2 py-2 text-center text-xs text-slate-600 dark:text-slate-300">
                                    {s.holiday || isUpcoming(s) ? '' : `${present}/${total}`}
                                </td>
                            );
                        })}
                        <td />
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

/* ---------------------------------------------------------------- roll call */

function RollCallDialog({
    week,
    session,
    recordsByKey,
    upcoming,
    onClose,
    onSaved,
}: {
    week: WeeklyAttendance;
    session: Session;
    recordsByKey: Map<string, WeeklyAttendanceRecord>;
    upcoming: boolean;
    onClose: () => void;
    onSaved: (saved: WeeklyAttendanceRecord[]) => void;
}) {
    const { tr } = useI18n();
    const initial = useMemo(() => {
        const entries: Record<string, RollEntry> = {};
        week.students.forEach((st) => {
            const r = recordsByKey.get(recordKey(st.id, session.date, session.startTime));
            entries[st.id] = { status: r?.status || null, note: r?.note || '' };
        });
        return entries;
        // The dialog is mounted per session: snapshot the records once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [entries, setEntries] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !saving) onClose();
        };
        document.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
        };
    }, [onClose, saving]);

    const changed = week.students.filter((st) => {
        const now = entries[st.id];
        const before = initial[st.id];
        return now.status && (now.status !== before.status || now.note.trim() !== before.note.trim());
    });
    const unmarked = week.students.filter((st) => !entries[st.id].status).length;

    const setEntry = (id: string, patch: Partial<RollEntry>) =>
        setEntries((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

    const markRestPresent = () =>
        setEntries((prev) => {
            const next = { ...prev };
            week.students.forEach((st) => {
                if (!next[st.id].status) next[st.id] = { ...next[st.id], status: 'PRESENT' };
            });
            return next;
        });

    const save = async () => {
        if (changed.length === 0) {
            onClose();
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const saved = await markSessionAttendance({
                groupId: week.group.id,
                date: session.date,
                slotStart: session.startTime,
                entries: changed.map((st) => ({
                    studentId: st.id,
                    status: entries[st.id].status!,
                    note: entries[st.id].note.trim() || null,
                })),
            });
            onSaved(
                saved.map((a) => ({
                    id: a.id,
                    studentId: a.studentId,
                    date: session.date,
                    slotStart: session.startTime,
                    status: a.status,
                    source: a.source || 'MANUAL',
                    scannedAt: a.scannedAt || null,
                    note: a.note ?? null,
                }))
            );
        } catch (e) {
            setError(attendanceErrorMessage(e, "L'enregistrement a échoué."));
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
            onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="roll-title"
        >
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-800 shadow-xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-700 px-5 py-4">
                    <div>
                        <h2 id="roll-title" className="text-lg font-bold text-slate-900 dark:text-white">{tr("Appel ·")}{week.group.name}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 first-letter:uppercase">
                            {longDay(session.date)} · {session.startTime} – {session.endTime}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} aria-label={tr("Fermer")} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>

                {upcoming && (
                    <p className="mx-5 mt-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 px-3 py-2 text-sm text-blue-800 dark:text-blue-300">{tr("Séance à venir : vous pouvez seulement saisir une absence justifiée à l'avance.")}</p>
                )}

                {!upcoming && unmarked > 0 && (
                    <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 px-3 py-2">
                        <span className="text-sm text-slate-600 dark:text-slate-300">{unmarked}{' '}{tr("élève(s) pas encore saisi(s)")}</span>
                        <button
                            type="button"
                            onClick={markRestPresent}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                            <CheckCheck size={16} />{tr("Les autres sont présents")}</button>
                    </div>
                )}

                <ul className="flex-1 divide-y divide-slate-100 dark:divide-slate-700 overflow-y-auto px-5 py-2">
                    {week.students.length === 0 && (
                        <li className="py-8 text-center text-sm text-slate-500">{tr("Aucun élève inscrit dans ce groupe.")}</li>
                    )}
                    {week.students.map((st) => {
                        const entry = entries[st.id];
                        const record = recordsByKey.get(recordKey(st.id, session.date, session.startTime));
                        const needsNote = entry.status && entry.status !== 'PRESENT';
                        return (
                            <li key={st.id} className="py-2.5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                            {st.name} {st.surname}
                                        </p>
                                        {record && (
                                            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                {record.source === 'SCAN' ? <ScanLine size={12} /> : <PenLine size={12} />}
                                                {tr(SOURCE_LABEL[record.source])}
                                                {record.scannedAt && ` à ${formatTime(record.scannedAt)}`}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={tr("Statut de {name}", { name: st.name })}>
                                        {ATTENDANCE_STATUSES.map((s) => {
                                            const selected = entry.status === s;
                                            return (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    aria-label={tr(ATTENDANCE_META[s].label)}
                                                    title={tr(ATTENDANCE_META[s].label)}
                                                    disabled={upcoming && s !== 'JUSTIFIED'}
                                                    onClick={() => setEntry(st.id, { status: s })}
                                                    className={`h-9 w-11 rounded-lg text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-30 ${
                                                        selected
                                                            ? `${ATTENDANCE_META[s].cell} ring-2 ring-offset-1 ring-current dark:ring-offset-slate-800`
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                                    }`}
                                                >
                                                    {tr(ATTENDANCE_META[s].short)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {(needsNote || entry.note) && (
                                    <input
                                        type="text"
                                        maxLength={300}
                                        value={entry.note}
                                        onChange={(e) => setEntry(st.id, { note: e.target.value })}
                                        placeholder={entry.status === 'JUSTIFIED' ? tr("Motif (ex. certificat médical)") : tr("Remarque (optionnel)")}
                                        aria-label={tr("Remarque pour {name}", { name: st.name })}
                                        className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                            </li>
                        );
                    })}
                </ul>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 dark:border-slate-700 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className={`text-sm ${error ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {error || (changed.length > 0 ? tr("{length} modification(s)", { length: changed.length }) : tr("Aucune modification"))}
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 sm:flex-none rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >{tr("Annuler")}</button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            className="flex-1 sm:flex-none rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {saving ? tr("Enregistrement…") : tr("Enregistrer")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------------------------------------------------------------- small pieces */

function StatusChip({ status }: { status: AttendanceStatus }) {
    const { tr } = useI18n();
    return (
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded font-bold ${ATTENDANCE_META[status].cell}`}>
            {tr(ATTENDANCE_META[status].short)}
        </span>
    );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="rounded-xl border border-slate-300 dark:border-slate-600 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
        >
            {children}
        </button>
    );
}

function EmptyState({
    icon,
    title,
    children,
    bare,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    bare?: boolean;
}) {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 py-12 px-6 text-center text-slate-400 dark:text-slate-500 ${
                bare ? '' : 'rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm'
            }`}
        >
            {icon}
            <p className="font-semibold text-slate-700 dark:text-slate-200">{title}</p>
            <p className="text-sm max-w-md">{children}</p>
        </div>
    );
}
