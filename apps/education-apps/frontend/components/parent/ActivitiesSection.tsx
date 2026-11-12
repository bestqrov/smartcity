'use client';

import { useState } from 'react';
import { CalendarDays, Lock, MapPin, PartyPopper, Wallet } from 'lucide-react';
import type { Parent, ParentActivity } from '@/types';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { formatDate, formatMoney } from '@/lib/parent/helpers';
import { answersOpen, upcomingActivities } from '@/lib/parent/activities';
import { answerParentActivity } from '@/lib/services/parents';
import { apiAssetUrl } from '@/lib/api';
import { Card, EmptyState, Ltr, SectionTitle } from './ui';

interface Props {
    token: string;
    parent: Parent;
    t: ParentMessages;
    lang: ParentLang;
    setActivities: (updater: (prev: ParentActivity[]) => ParentActivity[]) => void;
}

type Answer = 'YES' | 'NO' | null;

const DT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

export default function ActivitiesSection({ token, parent, t, lang, setActivities }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<string | null>(null);
    const list = upcomingActivities(parent.activities);
    const nameOf = (id: string) => parent.students.find((s) => s.id === id)?.name ?? '';

    const patch = (activityId: string, studentId: string, answer: Answer) =>
        setActivities((prev) =>
            prev.map((a) =>
                a.id !== activityId ? a : { ...a, children: a.children.map((c) => (c.studentId === studentId ? { ...c, answer } : c)) },
            ),
        );

    const answer = async (a: ParentActivity, studentId: string, value: 'YES' | 'NO') => {
        const before = a.children.find((c) => c.studentId === studentId)?.answer ?? null;
        if (before === value) return;
        const key = `${a.id}:${studentId}`;
        setError(null);
        setPending(key);
        patch(a.id, studentId, value);
        try {
            await answerParentActivity(token, { activityId: a.id, studentId, answer: value });
        } catch (err) {
            patch(a.id, studentId, before);
            // The backend reason (deadline passed, already started…) when there is one.
            const reason = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(reason && reason !== 'Internal server error' ? reason : t.answerError);
        } finally {
            setPending(null);
        }
    };

    return (
        <Card>
            <SectionTitle icon={PartyPopper}>{t.activities}</SectionTitle>
            {error && <p className="mb-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
            {list.length === 0 ? (
                <EmptyState icon={PartyPopper} title={t.noActivities} />
            ) : (
                <ul className="space-y-4">
                    {list.map((a) => {
                        const open = answersOpen(a);
                        return (
                            <li key={a.id} className="overflow-hidden rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                                {a.hasCover && a.coverUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={apiAssetUrl(a.coverUrl)} alt="" loading="lazy" className="h-36 w-full object-cover" />
                                )}
                                <div className="space-y-1.5 p-3">
                                    <p className="font-semibold text-slate-900 dark:text-white">{a.title}</p>
                                    <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                        <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                        <Ltr>{formatDate(a.startAt, lang, DT)}</Ltr>
                                    </p>
                                    {a.location && (
                                        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                            <span className="min-w-0 truncate">{a.location}</span>
                                        </p>
                                    )}
                                    <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                        <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                        {a.price ? <Ltr>{formatMoney(a.price, t.currency)}</Ltr> : t.free}
                                    </p>
                                    {a.description && <p className="whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{a.description}</p>}
                                    {a.needsConsent && (
                                        <div className="space-y-2 pt-2">
                                            {open && a.deadline && (
                                                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                                    {t.answerBefore('')}
                                                    <Ltr>{formatDate(a.deadline, lang, { day: 'numeric', month: 'short' })}</Ltr>
                                                </p>
                                            )}
                                            {!open && (
                                                <p className="flex items-center gap-1 text-xs text-slate-400">
                                                    <Lock className="h-3.5 w-3.5" aria-hidden /> {t.answersClosed}
                                                </p>
                                            )}
                                            {a.children.map((c) => {
                                                const busy = pending === `${a.id}:${c.studentId}`;
                                                return (
                                                    <div key={c.studentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-2 dark:bg-slate-900">
                                                        <span className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                                            {nameOf(c.studentId)}
                                                            {c.paid && (
                                                                <span className="ms-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                                                                    {t.paidBadge}
                                                                </span>
                                                            )}
                                                        </span>
                                                        {open ? (
                                                            <div className="flex gap-1.5">
                                                                {(['YES', 'NO'] as const).map((v) => {
                                                                    const on = c.answer === v;
                                                                    return (
                                                                        <button
                                                                            key={v}
                                                                            type="button"
                                                                            disabled={busy}
                                                                            onClick={() => answer(a, c.studentId, v)}
                                                                            aria-pressed={on}
                                                                            className={`min-w-[3.5rem] rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-60 ${
                                                                                on
                                                                                    ? v === 'YES'
                                                                                        ? 'bg-emerald-600 text-white'
                                                                                        : 'bg-rose-600 text-white'
                                                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                                                            }`}
                                                                        >
                                                                            {v === 'YES' ? t.yes : t.no}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                    c.answer === 'YES'
                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                                                        : c.answer === 'NO'
                                                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                                                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                                                }`}
                                                            >
                                                                {c.answer === 'YES' ? t.participates : c.answer === 'NO' ? t.notParticipating : t.noAnswer}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
