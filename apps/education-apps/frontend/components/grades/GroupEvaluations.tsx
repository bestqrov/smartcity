'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import type { Evaluation, EvaluationWithGrades, Grade, GradesClient, GradeStudent } from '@/lib/services/grades';
import { apiErrorMessage } from '@/lib/services/grades';
import EvaluationList from './EvaluationList';
import EvaluationForm from './EvaluationForm';
import GradeEntry from './GradeEntry';
import PublishButton from './PublishButton';
import { formatDate, formatNum } from './utils';

interface Props {
    client: GradesClient;
    groupId: string;
    groupSubject?: string;
    students: GradeStudent[];
    periods: string[];
    evaluations: EvaluationWithGrades[];
    /** State lives with the caller so it survives navigation; updated from mutation responses only. */
    setEvaluations: (updater: (prev: EvaluationWithGrades[]) => EvaluationWithGrades[]) => void;
}

/** A group's evaluations list → grade entry for one evaluation. */
export default function GroupEvaluations({ client, groupId, groupSubject, students, periods, evaluations, setEvaluations }: Props) {
    const [openId, setOpenId] = useState<string | null>(null);
    const invalidRef = useRef(false);
    const [form, setForm] = useState<{ evaluation: Evaluation | null } | null>(null);

    const merge = (ev: Evaluation) =>
        setEvaluations((prev) => {
            const exists = prev.some((e) => e.id === ev.id);
            if (!exists) return [{ ...ev, grades: [] }, ...prev];
            return prev.map((e) => (e.id === ev.id ? { ...e, ...ev, grades: e.grades } : e));
        });

    const remove = async (ev: Evaluation) => {
        if (!window.confirm(`Supprimer « ${ev.title} » et toutes ses notes ?`)) return;
        try {
            await client.deleteEvaluation(ev.id);
            setEvaluations((prev) => prev.filter((e) => e.id !== ev.id));
            if (openId === ev.id) setOpenId(null);
        } catch (err) {
            window.alert(apiErrorMessage(err));
        }
    };

    const open = evaluations.find((e) => e.id === openId) ?? null;

    if (open) {
        return (
            <div className="space-y-4">
                <div className="flex items-start gap-2">
                    <button type="button" onClick={() => {
                            if (invalidRef.current && !window.confirm('Des notes invalides ne seront pas enregistrées. Quitter ?')) return;
                            setOpenId(null);
                        }}
                        aria-label="Retour" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{open.title}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {open.subject} · {open.period} · {formatDate(open.date)} · coef {formatNum(open.coefficient)}
                        </p>
                    </div>
                    <PublishButton client={client} evaluation={open} studentIds={students.map((s) => s.id)} onChange={merge} />
                </div>
                <GradeEntry
                    key={`${open.id}:${open.updatedAt}`}
                    onInvalidChange={(v) => {
                        invalidRef.current = v;
                    }}
                    client={client}
                    evaluation={open}
                    students={students}
                    onGradesSaved={(grades: Grade[]) =>
                        setEvaluations((prev) =>
                            prev.map((e) => {
                                if (e.id !== open.id) return e;
                                const byStudent = new Map(e.grades.map((g) => [g.studentId, g]));
                                grades.forEach((g) => byStudent.set(g.studentId, g));
                                return { ...e, grades: Array.from(byStudent.values()) };
                            }),
                        )
                    }
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {periods.length === 0 && (
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    Aucune période de notation n’est configurée.
                </p>
            )}
            <button
                type="button"
                onClick={() => setForm({ evaluation: null })}
                disabled={periods.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto sm:px-4"
            >
                <Plus size={18} /> Nouvelle évaluation
            </button>
            <EvaluationList
                evaluations={evaluations}
                studentCount={students.length}
                onOpen={(ev) => setOpenId(ev.id)}
                onEdit={(ev) => setForm({ evaluation: ev })}
                onDelete={remove}
            />
            {form && (
                <EvaluationForm
                    client={client}
                    groupId={groupId}
                    periods={periods}
                    defaultSubject={groupSubject}
                    evaluation={form.evaluation}
                    onClose={() => setForm(null)}
                    onSaved={(ev) => {
                        merge(ev);
                        setForm(null);
                        if (!form.evaluation) setOpenId(ev.id);
                    }}
                />
            )}
        </div>
    );
}
