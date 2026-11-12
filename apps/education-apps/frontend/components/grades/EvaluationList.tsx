'use client';

import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import type { EvaluationWithGrades } from '@/lib/services/grades';
import { evaluationStats, formatDate, formatNum } from './utils';

interface Props {
    evaluations: EvaluationWithGrades[];
    studentCount: number;
    onOpen: (ev: EvaluationWithGrades) => void;
    onEdit?: (ev: EvaluationWithGrades) => void;
    onDelete?: (ev: EvaluationWithGrades) => void;
}

export default function EvaluationList({ evaluations, studentCount, onOpen, onEdit, onDelete }: Props) {
    if (!evaluations.length) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Aucune évaluation pour le moment.
            </div>
        );
    }
    return (
        <ul className="space-y-3">
            {evaluations.map((ev) => {
                const { entered, total, average } = evaluationStats(ev, studentCount);
                return (
                    <li
                        key={ev.id}
                        className="flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
                    >
                        <button type="button" onClick={() => onOpen(ev)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-semibold text-slate-900 dark:text-white">{ev.title}</span>
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                            ev.published
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        {ev.published ? 'Publiée' : 'Brouillon'}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {ev.subject} · {ev.period} · {formatDate(ev.date)} · /{formatNum(ev.maxScore)} · coef {formatNum(ev.coefficient)}
                                </p>
                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                    {entered}/{total} saisies · Moyenne : {average === null ? '—' : formatNum(average)}
                                </p>
                            </div>
                            <ChevronRight size={18} className="shrink-0 text-slate-400" />
                        </button>
                        {onEdit && (
                            <button type="button" onClick={() => onEdit(ev)} aria-label="Modifier" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                                <Pencil size={16} />
                            </button>
                        )}
                        {onDelete && (
                            <button type="button" onClick={() => onDelete(ev)} aria-label="Supprimer" className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                                <Trash2 size={16} />
                            </button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
