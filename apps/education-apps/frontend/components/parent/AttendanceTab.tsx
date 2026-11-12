'use client';

import { CalendarCheck2, History } from 'lucide-react';
import type { Attendance, AttendanceStatus, Student } from '@/types';
import { ATTENDANCE_META, ATTENDANCE_STATUSES, toDateKey } from '@/lib/attendanceStatus';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { formatDate } from '@/lib/parent/helpers';
import { Card, EmptyState, Ltr, SectionTitle } from './ui';

interface Props {
    student: Student;
    t: ParentMessages;
    lang: ParentLang;
}

export default function AttendanceTab({ student, t, lang }: Props) {
    const records = student.attendances || [];
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);

    const counts = ATTENDANCE_STATUSES.reduce(
        (acc, s) => ({ ...acc, [s]: 0 }),
        {} as Record<AttendanceStatus, number>
    );
    records.forEach((a) => {
        if (new Date(a.date) >= since) counts[a.status] += 1;
    });

    // Group by local day, keeping the backend order (date desc, slotStart desc).
    const byDay: { key: string; items: Attendance[] }[] = [];
    records.forEach((a) => {
        const key = toDateKey(new Date(a.date));
        const last = byDay[byDay.length - 1];
        if (last && last.key === key) last.items.push(a);
        else byDay.push({ key, items: [a] });
    });

    const groupName = (id?: string) => (student.groups || []).find((g) => g.id === id);

    return (
        <div className="space-y-4">
            <Card>
                <SectionTitle icon={CalendarCheck2}>{t.last30Days}</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                    {ATTENDANCE_STATUSES.map((s) => (
                        <div key={s} className={`rounded-2xl border p-3 ${ATTENDANCE_META[s].badge}`}>
                            <p className="text-2xl font-bold leading-none">
                                <Ltr>{counts[s]}</Ltr>
                            </p>
                            <p className="mt-1 text-xs font-medium">{t.attendanceStatus[s]}</p>
                        </div>
                    ))}
                </div>
            </Card>

            <Card>
                <SectionTitle icon={History}>{t.history}</SectionTitle>
                {byDay.length === 0 ? (
                    <EmptyState icon={CalendarCheck2} title={t.noAttendance} hint={t.noAttendanceHint} />
                ) : (
                    <ol className="space-y-4">
                        {byDay.map(({ key, items }) => (
                            <li key={key}>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <Ltr>{formatDate(items[0].date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</Ltr>
                                </p>
                                <ul className="space-y-2">
                                    {items.map((a) => {
                                        const g = groupName(a.groupId);
                                        return (
                                            <li
                                                key={a.id}
                                                className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                                        {g?.subject || g?.name || a.group?.name || '—'}
                                                    </p>
                                                    {a.slotStart && (
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                                            <Ltr>{a.slotStart}</Ltr>
                                                        </p>
                                                    )}
                                                </div>
                                                <span
                                                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${ATTENDANCE_META[a.status].badge}`}
                                                >
                                                    {t.attendanceStatus[a.status]}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        ))}
                    </ol>
                )}
            </Card>
        </div>
    );
}
