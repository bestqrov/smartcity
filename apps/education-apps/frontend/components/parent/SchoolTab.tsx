'use client';

import { Baby, Bus, CalendarDays, Mail, Megaphone, Palmtree, Phone, School, Users } from 'lucide-react';
import type { Parent, Student } from '@/types';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { DAY_ORDER, allSlots, formatDate } from '@/lib/parent/helpers';
import { whatsappNumber } from '@/lib/publicUrl';
import { Card, EmptyState, Ltr, SectionTitle } from './ui';
import { PushToggleRow } from './PushToggleRow';

interface Props {
    token: string;
    parent: Parent;
    student: Student;
    t: ParentMessages;
    lang: ParentLang;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
        <span className="shrink-0 text-slate-500 dark:text-slate-400">{label}</span>
        <span className="min-w-0 text-end font-medium text-slate-800 dark:text-slate-100">{children}</span>
    </div>
);

export default function SchoolTab({ token, parent, student, t, lang }: Props) {
    const groups = student.groups || [];
    const slots = allSlots(groups);
    const days = DAY_ORDER.filter((d) => slots.some((s) => s.day === d));
    const transport = student.transportSubscriptions || [];
    const pickup = student.authorizedPickup || [];
    const hasCreche = !!(student.crecheSection || student.healthNotes || pickup.length > 0);
    const school = parent.school;
    const wa = whatsappNumber(school?.phone);

    return (
        <div className="space-y-4">
            <Card>
                <SectionTitle icon={Users}>{t.groups}</SectionTitle>
                {groups.length === 0 ? (
                    <EmptyState icon={Users} title={t.noGroups} />
                ) : (
                    <ul className="space-y-2">
                        {groups.map((g) => (
                            <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                                    {(g.subject || g.name).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{g.subject || g.name}</p>
                                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                        {[g.name !== g.subject ? g.name : null, g.level].filter(Boolean).join(' · ')}
                                        {g.teacher?.name && ` · ${t.teacher} : ${g.teacher.name}`}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card>
                <SectionTitle icon={CalendarDays}>{t.timetable}</SectionTitle>
                {days.length === 0 ? (
                    <EmptyState icon={CalendarDays} title={t.noTimetable} />
                ) : (
                    <div className="space-y-3">
                        {days.map((day) => (
                            <div key={day}>
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{t.days[day] || day}</p>
                                <ul className="space-y-1.5">
                                    {slots
                                        .filter((s) => s.day === day)
                                        .map((s, i) => (
                                            <li key={i} className="flex items-center gap-3 rounded-xl border-s-4 border-indigo-400 bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                                                <span className="shrink-0 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                                                    <Ltr>
                                                        {s.startTime}–{s.endTime}
                                                    </Ltr>
                                                </span>
                                                <span className="min-w-0 truncate text-sm text-slate-700 dark:text-slate-200">{s.group.subject || s.group.name}</span>
                                            </li>
                                        ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {transport.map((sub) => (
                <Card key={sub.id}>
                    <SectionTitle icon={Bus}>
                        {t.transport} — {sub.route?.name}
                        {sub.status === 'PAUSED' && <span className="text-xs font-normal text-slate-400">({t.paused})</span>}
                    </SectionTitle>
                    {sub.stop && <Row label={t.stop}>{sub.stop.name}</Row>}
                    {sub.stop?.morningTime && (
                        <Row label={t.morning}>
                            <Ltr>{sub.stop.morningTime}</Ltr>
                        </Row>
                    )}
                    {sub.stop?.afternoonTime && (
                        <Row label={t.afternoon}>
                            <Ltr>{sub.stop.afternoonTime}</Ltr>
                        </Row>
                    )}
                    {sub.route?.vehicle?.plate && (
                        <Row label={t.vehicle}>
                            <Ltr>{sub.route.vehicle.plate}</Ltr>
                        </Row>
                    )}
                    {sub.route?.driver && (
                        <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                            <div className="min-w-0">
                                <p className="text-xs text-slate-500 dark:text-slate-400">{t.driver}</p>
                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{sub.route.driver.name}</p>
                            </div>
                            {sub.route.driver.phone && (
                                <a
                                    href={`tel:${sub.route.driver.phone}`}
                                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-2 text-xs font-semibold text-white active:scale-95"
                                >
                                    <Phone className="h-3.5 w-3.5" aria-hidden />
                                    <Ltr>{sub.route.driver.phone}</Ltr>
                                </a>
                            )}
                        </div>
                    )}
                </Card>
            ))}

            {hasCreche && (
                <Card>
                    <SectionTitle icon={Baby}>{t.creche}</SectionTitle>
                    {student.crecheSection && <Row label={t.section}>{t.crecheSections[student.crecheSection] || student.crecheSection}</Row>}
                    {student.massarNumber && (
                        <Row label={t.massar}>
                            <Ltr>{student.massarNumber}</Ltr>
                        </Row>
                    )}
                    {student.healthNotes && <Row label={t.health}>{student.healthNotes}</Row>}
                    {pickup.length > 0 && (
                        <div className="mt-2">
                            <p className="mb-1.5 text-sm text-slate-500 dark:text-slate-400">{t.authorizedPickup}</p>
                            <ul className="space-y-1.5">
                                {pickup.map((p, i) => (
                                    <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
                                        <span className="min-w-0 truncate text-slate-800 dark:text-slate-100">
                                            {p.name} <span className="text-xs text-slate-400">({p.relation})</span>
                                        </span>
                                        <Ltr className="shrink-0 text-xs text-slate-500">{p.phone}</Ltr>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </Card>
            )}

            <Card>
                <SectionTitle icon={Megaphone}>{t.announcements}</SectionTitle>
                {(parent.announcements || []).length === 0 ? (
                    <EmptyState icon={Megaphone} title={t.noAnnouncements} />
                ) : (
                    <ul className="space-y-3">
                        {(parent.announcements || []).map((a) => (
                            <li key={a.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{a.title}</p>
                                <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{a.body}</p>
                                <p className="mt-1.5 text-xs text-slate-400">
                                    <Ltr>{formatDate(a.createdAt, lang)}</Ltr>
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card>
                <SectionTitle icon={Palmtree}>{t.holidays}</SectionTitle>
                {(parent.holidays || []).length === 0 ? (
                    <EmptyState icon={Palmtree} title={t.noHolidays} />
                ) : (
                    <ul className="space-y-2">
                        {(parent.holidays || []).map((h) => (
                            <li key={h.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{h.title}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {t.from} <Ltr>{formatDate(h.startDate, lang)}</Ltr> {t.to} <Ltr>{formatDate(h.endDate, lang)}</Ltr>
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <PushToggleRow token={token} t={t} lang={lang} />

            {school && (
                <Card>
                    <SectionTitle icon={School}>{t.contact}</SectionTitle>
                    <p className="font-semibold text-slate-900 dark:text-white">{school.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {school.phone && (
                            <a href={`tel:${school.phone}`} className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white active:scale-95">
                                <Phone className="h-3.5 w-3.5" aria-hidden />
                                <Ltr>{school.phone}</Ltr>
                            </a>
                        )}
                        {wa && (
                            <a
                                href={`https://wa.me/${wa}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white active:scale-95"
                            >
                                {t.whatsapp}
                            </a>
                        )}
                        {school.email && (
                            <a href={`mailto:${school.email}`} className="flex min-w-0 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <Ltr className="truncate">{school.email}</Ltr>
                            </a>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}
