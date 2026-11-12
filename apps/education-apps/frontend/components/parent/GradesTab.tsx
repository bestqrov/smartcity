'use client';

import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import type { Parent, Student } from '@/types';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { formatDate } from '@/lib/parent/helpers';
import { averageTone, defaultPeriod, formatAverage, generalAverage, periodSubjects } from '@/lib/parent/grades';
import { Card, EmptyState, Ltr } from './ui';

interface Props {
    parent: Parent;
    student: Student;
    t: ParentMessages;
    lang: ParentLang;
}

const TONE = {
    green: 'from-emerald-500 to-teal-600 shadow-emerald-500/20',
    amber: 'from-amber-500 to-orange-500 shadow-amber-500/20',
    red: 'from-rose-500 to-red-600 shadow-rose-500/20',
    none: 'from-slate-400 to-slate-500 shadow-slate-500/20',
};
const TEXT = {
    green: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-rose-600 dark:text-rose-400',
    none: 'text-slate-400',
};

export default function GradesTab({ parent, student, t, lang }: Props) {
    const grades = student.grades || [];
    // Periods from the school config, plus any period present on a grade but no longer configured.
    const configured = parent.gradingPeriods || [];
    const periods = [...configured, ...grades.map((g) => g.period).filter((p, i, a) => !configured.includes(p) && a.indexOf(p) === i)];
    const [chosen, setChosen] = useState<string | null>(null);
    const period = chosen && periods.includes(chosen) ? chosen : defaultPeriod(periods, grades);

    if (grades.length === 0 || !period) {
        return (
            <Card>
                <EmptyState icon={GraduationCap} title={t.noGrades} />
            </Card>
        );
    }

    const subjects = periodSubjects(grades, period);
    const general = generalAverage(subjects);
    const tone = averageTone(general);

    return (
        <div className="space-y-4">
            {periods.length > 1 && (
                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {periods.map((p) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setChosen(p)}
                            aria-pressed={p === period}
                            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition active:scale-95 ${
                                p === period
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                    : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800'
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}

            <div className={`rounded-3xl bg-gradient-to-br ${TONE[tone]} p-5 text-white shadow-lg`}>
                <p className="text-sm text-white/80">{t.generalAverage}</p>
                <p className="mt-1 text-4xl font-bold">
                    <Ltr>{formatAverage(general)}</Ltr>
                    <span className="text-lg font-medium text-white/80"> /20</span>
                </p>
            </div>

            {subjects.length === 0 ? (
                <Card>
                    <EmptyState icon={GraduationCap} title={t.noGrades} />
                </Card>
            ) : (
                subjects.map((s) => (
                    <Card key={s.subject}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <h3 className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">{s.subject}</h3>
                            <span className={`shrink-0 text-lg font-bold ${TEXT[averageTone(s.average)]}`}>
                                <Ltr>{formatAverage(s.average)}</Ltr>
                                <span className="text-xs font-medium text-slate-400"> /20</span>
                            </span>
                        </div>
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {s.grades.filter((g) => g.absent || g.score != null).map((g) => (
                                <li key={g.evaluationId} className="flex items-start justify-between gap-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{g.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            <Ltr>{formatDate(g.date, lang)}</Ltr>
                                            {g.coefficient !== 1 && <> · {t.coefficient(g.coefficient)}</>}
                                        </p>
                                        {g.comment && <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">{g.comment}</p>}
                                    </div>
                                    <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">
                                        {g.absent ? (
                                            <span className="text-xs font-semibold text-slate-400">{t.absentGrade}</span>
                                        ) : (
                                            <Ltr>
                                                {g.score}/{g.maxScore}
                                            </Ltr>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </Card>
                ))
            )}
        </div>
    );
}
