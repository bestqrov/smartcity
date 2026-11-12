'use client';

import { BookOpen, Check } from 'lucide-react';
import type { Student } from '@/types';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { formatDate } from '@/lib/parent/helpers';
import { HW_BUCKETS, groupHomework, parseDueDate, useHomeworkDone } from '@/lib/parent/homework';
import { Card, EmptyState, Ltr, SectionTitle } from './ui';

interface Props {
    student: Student;
    t: ParentMessages;
    lang: ParentLang;
}

export default function HomeworkSection({ student, t, lang }: Props) {
    const { done, toggle } = useHomeworkDone();
    const groups = groupHomework(student.homework || []);
    const any = HW_BUCKETS.some((b) => groups[b].length > 0);

    return (
        <Card>
            <SectionTitle icon={BookOpen}>{t.homework}</SectionTitle>
            {!any ? (
                <EmptyState icon={BookOpen} title={t.noHomework} />
            ) : (
                <div className="space-y-4">
                    {HW_BUCKETS.filter((b) => groups[b].length > 0).map((b) => (
                        <div key={b}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.hwGroups[b]}</p>
                            <ul className="space-y-2">
                                {groups[b].map((h) => {
                                    const isDone = done.includes(h.id);
                                    return (
                                        <li key={h.id} className={`flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60 ${isDone || b === 'past' ? 'opacity-60' : ''}`}>
                                            <button
                                                type="button"
                                                onClick={() => toggle(h.id)}
                                                aria-pressed={isDone}
                                                aria-label={t.hwDone}
                                                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition active:scale-90 ${
                                                    isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'
                                                }`}
                                            >
                                                {isDone && <Check className="h-4 w-4" aria-hidden />}
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-sm font-semibold text-slate-900 dark:text-white ${isDone ? 'line-through' : ''}`}>{h.title}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {[h.subject, h.groupName].filter(Boolean).join(' · ')} · {t.dueFor}{' '}
                                                    <Ltr>{formatDate(parseDueDate(h), lang, { weekday: 'short', day: 'numeric', month: 'short' })}</Ltr>
                                                </p>
                                                {h.details && <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{h.details}</p>}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
