'use client';

import { BookOpen, CalendarClock, MapPin, PartyPopper, CheckCircle2, Clock, GraduationCap, Megaphone, Palmtree, Wallet } from 'lucide-react';
import type { Parent, Student } from '@/types';
import { ATTENDANCE_META } from '@/lib/attendanceStatus';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { formatDate, formatMoney, isSameLocalDay, nextSession, studentBalance } from '@/lib/parent/helpers';
import { Card, EmptyState, Ltr, SectionTitle } from './ui';
import { PushPrompt } from './PushPrompt';
import { upcomingActivities } from '@/lib/parent/activities';
import { apiAssetUrl } from '@/lib/api';
import { dayKey, dueKey } from '@/lib/parent/homework';

interface Props {
    token: string;
    parent: Parent;
    student: Student;
    t: ParentMessages;
    lang: ParentLang;
    goTo: (tab: 'payments' | 'school' | 'grades') => void;
}

export default function HomeTab({ token, parent, student, t, lang, goTo }: Props) {
    const now = new Date();
    const todays = (student.attendances || []).filter((a) => isSameLocalDay(a.date, now));
    // Newest session first (backend sorts slotStart desc within a day).
    const todayStatus = todays[0]?.status;
    const next = nextSession(student.groups, now);
    const balance = studentBalance(student);
    const latest = (parent.announcements || [])[0];
    const holiday = (parent.holidays || [])[0];
    const nextActivity = upcomingActivities(parent.activities, now).find(
        (a) => a.children.length === 0 || a.children.some((c) => c.studentId === student.id),
    );
    const tmr = new Date(now);
    tmr.setDate(tmr.getDate() + 1);
    const soonKeys = [dayKey(now), dayKey(tmr)];
    const homeworkSoon = (student.homework || []).filter((h) => soonKeys.includes(dueKey(h))).sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
    const hasHomework = (student.homework || []).length > 0;
    const latestGrades = (student.grades || []).filter((g) => g.absent || g.score != null).slice(0, 3);

    return (
        <div className="space-y-4">
            {/* Today */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-indigo-500/20">
                <div className="pointer-events-none absolute -end-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-12 -start-6 h-32 w-32 rounded-full bg-white/10" />
                <p className="relative text-sm text-indigo-100">
                    {t.today} · <Ltr>{formatDate(now.toISOString(), lang, { weekday: 'long', day: 'numeric', month: 'long' })}</Ltr>
                </p>
                <p className="relative mt-1 text-lg font-semibold">
                    {student.name} {student.surname}
                </p>
                <div className="relative mt-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                        {todayStatus ? <CheckCircle2 className="h-6 w-6" aria-hidden /> : <Clock className="h-6 w-6" aria-hidden />}
                    </div>
                    <div className="min-w-0">
                        {todayStatus ? (
                            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-bold">
                                <span className={ATTENDANCE_META[todayStatus].text}>{t.attendanceStatus[todayStatus]}</span>
                            </span>
                        ) : (
                            <p className="text-base font-semibold">{t.notMarkedYet}</p>
                        )}
                        {todays.length > 1 && <p className="mt-1 text-xs text-indigo-100">{t.sessionsToday(todays.length)}</p>}
                    </div>
                </div>
            </div>

            <PushPrompt token={token} t={t} lang={lang} />

            <div className="grid grid-cols-2 gap-3">
                {/* Next session */}
                <Card className="!p-4">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                        <CalendarClock className="h-5 w-5" aria-hidden />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.nextSession}</p>
                    {next ? (
                        <>
                            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {next.group.subject || next.group.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t.days[next.day] || next.day} · <Ltr>{next.startTime}</Ltr>
                            </p>
                        </>
                    ) : (
                        <p className="mt-0.5 text-sm text-slate-400">{t.noUpcomingSession}</p>
                    )}
                </Card>

                {/* Balance */}
                <button type="button" onClick={() => goTo('payments')} className="text-start">
                    <Card className="h-full !p-4">
                        <div
                            className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${
                                balance > 0
                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                            }`}
                        >
                            <Wallet className="h-5 w-5" aria-hidden />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.balanceDue}</p>
                        {balance > 0 ? (
                            <p className="mt-0.5 text-sm font-bold text-rose-600 dark:text-rose-400">
                                <Ltr>{formatMoney(balance, t.currency)}</Ltr>
                            </p>
                        ) : (
                            <p className="mt-0.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{t.allPaid}</p>
                        )}
                    </Card>
                </button>
            </div>

            {nextActivity && (
                <button type="button" onClick={() => goTo('school')} className="block w-full text-start">
                    <Card className="overflow-hidden !p-0">
                        {nextActivity.hasCover && nextActivity.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={apiAssetUrl(nextActivity.coverUrl)} alt="" className="h-32 w-full object-cover" />
                        ) : (
                            <div className="flex h-20 items-center justify-center bg-gradient-to-br from-pink-500 to-violet-600 text-white">
                                <PartyPopper className="h-8 w-8" aria-hidden />
                            </div>
                        )}
                        <div className="p-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{t.nextActivity}</p>
                            <p className="mt-0.5 truncate font-semibold text-slate-900 dark:text-white">{nextActivity.title}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                                <Ltr>{formatDate(nextActivity.startAt, lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Ltr>
                                {nextActivity.location && (
                                    <span className="inline-flex min-w-0 items-center gap-1">
                                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                                        <span className="truncate">{nextActivity.location}</span>
                                    </span>
                                )}
                            </p>
                        </div>
                    </Card>
                </button>
            )}

            {hasHomework && (
                <Card>
                    <SectionTitle
                        icon={BookOpen}
                        action={
                            <button type="button" onClick={() => goTo('grades')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                {t.seeAll}
                            </button>
                        }
                    >
                        {t.homeworkSoon}
                    </SectionTitle>
                    {homeworkSoon.length === 0 ? (
                        <p className="text-sm text-slate-400">{t.noHomeworkSoon}</p>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {homeworkSoon.slice(0, 4).map((h) => (
                                <li key={h.id}>
                                    <button type="button" onClick={() => goTo('grades')} className="flex w-full items-center justify-between gap-3 py-2 text-start">
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{h.title}</span>
                                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{h.subject || h.groupName}</span>
                                        </span>
                                        <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                                            {dueKey(h) === soonKeys[0] ? t.hwGroups.today : t.hwGroups.tomorrow}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            )}

            {latestGrades.length > 0 && (
                <Card>
                    <SectionTitle
                        icon={GraduationCap}
                        action={
                            <button type="button" onClick={() => goTo('grades')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                {t.seeAll}
                            </button>
                        }
                    >
                        {t.latestGrades}
                    </SectionTitle>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {latestGrades.map((g) => (
                            <li key={g.evaluationId}>
                                <button type="button" onClick={() => goTo('grades')} className="flex w-full items-center justify-between gap-3 py-2 text-start">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{g.subject}</span>
                                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{g.title}</span>
                                    </span>
                                    <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                                        {g.absent ? (
                                            <span className="text-xs font-semibold text-slate-400">{t.absentGrade}</span>
                                        ) : (
                                            <Ltr>
                                                {g.score}/{g.maxScore}
                                            </Ltr>
                                        )}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <Card>
                <SectionTitle
                    icon={Megaphone}
                    action={
                        latest && (
                            <button type="button" onClick={() => goTo('school')} className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                {t.seeAll}
                            </button>
                        )
                    }
                >
                    {t.latestAnnouncement}
                </SectionTitle>
                {latest ? (
                    <div>
                        <p className="font-medium text-slate-900 dark:text-white">{latest.title}</p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{latest.body}</p>
                        <p className="mt-2 text-xs text-slate-400">
                            <Ltr>{formatDate(latest.createdAt, lang)}</Ltr>
                        </p>
                    </div>
                ) : (
                    <EmptyState icon={Megaphone} title={t.noAnnouncements} />
                )}
            </Card>

            <Card>
                <SectionTitle icon={Palmtree}>{t.nextHoliday}</SectionTitle>
                {holiday ? (
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-xl dark:bg-amber-500/10">🌴</div>
                        <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-white">{holiday.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t.from} <Ltr>{formatDate(holiday.startDate, lang)}</Ltr> {t.to} <Ltr>{formatDate(holiday.endDate, lang)}</Ltr>
                            </p>
                        </div>
                    </div>
                ) : (
                    <EmptyState icon={Palmtree} title={t.noHolidays} />
                )}
            </Card>
        </div>
    );
}
