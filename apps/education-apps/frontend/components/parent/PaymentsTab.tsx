'use client';

import { Bus, FileText, Info, Receipt } from 'lucide-react';
import type { Student } from '@/types';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { formatDate, formatMoney, studentOwed, studentPaid } from '@/lib/parent/helpers';
import { Card, EmptyState, Ltr, SectionTitle } from './ui';

interface Props {
    student: Student;
    t: ParentMessages;
    lang: ParentLang;
}

export default function PaymentsTab({ student, t, lang }: Props) {
    const owed = studentOwed(student);
    const paid = studentPaid(student);
    const balance = owed - paid;
    const inscriptions = [...(student.inscriptions || [])].sort((a, b) => b.date.localeCompare(a.date));
    const payments = [...(student.payments || [])].sort((a, b) => b.date.localeCompare(a.date));
    const transport = student.transportSubscriptions || [];

    return (
        <div className="space-y-4">
            <Card>
                <div className="grid grid-cols-3 divide-x divide-slate-100 text-center rtl:divide-x-reverse dark:divide-slate-800">
                    {[
                        { label: t.owed, value: owed, cls: 'text-slate-900 dark:text-white' },
                        { label: t.paid, value: paid, cls: 'text-emerald-600 dark:text-emerald-400' },
                        {
                            label: t.balance,
                            value: balance,
                            cls: balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
                        },
                    ].map((x) => (
                        <div key={x.label} className="min-w-0 px-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{x.label}</p>
                            <p className={`mt-1 truncate text-sm font-bold ${x.cls}`}>
                                <Ltr>{formatMoney(x.value, t.currency)}</Ltr>
                            </p>
                        </div>
                    ))}
                </div>
                <p className="mt-4 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {t.feesNote}
                </p>
            </Card>

            {transport.length > 0 && (
                <Card>
                    <SectionTitle icon={Bus}>{t.transport}</SectionTitle>
                    <ul className="space-y-2">
                        {transport.map((sub) => {
                            const paidMonth = (sub.payments || []).length > 0;
                            return (
                                <li key={sub.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
                                    <span className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                                        {sub.route?.name}
                                        {sub.status === 'PAUSED' && <span className="ms-1 text-xs text-slate-400">({t.paused})</span>}
                                    </span>
                                    <span
                                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                            paidMonth
                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
                                        }`}
                                    >
                                        {paidMonth ? t.transportMonthPaid : t.transportMonthDue(`⁦${formatMoney(sub.monthlyPrice, t.currency)}⁩`)}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}

            <Card>
                <SectionTitle icon={FileText}>{t.inscriptions}</SectionTitle>
                {inscriptions.length === 0 ? (
                    <EmptyState icon={FileText} title={t.noInscriptions} />
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {inscriptions.map((i) => (
                            <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{i.category}</p>
                                    <p className="text-xs text-slate-400">
                                        <Ltr>{formatDate(i.date, lang)}</Ltr>
                                    </p>
                                </div>
                                <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">
                                    <Ltr>{formatMoney(i.amount, t.currency)}</Ltr>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card>
                <SectionTitle icon={Receipt}>{t.payments}</SectionTitle>
                {payments.length === 0 ? (
                    <EmptyState icon={Receipt} title={t.noPayments} />
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {payments.map((p) => (
                            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{p.method}</p>
                                    <p className="text-xs text-slate-400">
                                        <Ltr>{formatDate(p.date, lang)}</Ltr>
                                    </p>
                                </div>
                                <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                    <Ltr>+{formatMoney(p.amount, t.currency)}</Ltr>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}
