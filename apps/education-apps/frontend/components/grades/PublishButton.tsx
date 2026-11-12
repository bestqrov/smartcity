'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { Evaluation, EvaluationWithGrades, GradesClient } from '@/lib/services/grades';
import { apiErrorMessage } from '@/lib/services/grades';

interface Props {
    client: GradesClient;
    evaluation: EvaluationWithGrades;
    studentIds: string[];
    onChange: (ev: Evaluation) => void;
}

export default function PublishButton({ client, evaluation, studentIds, onChange }: Props) {
    const [busy, setBusy] = useState(false);

    const toggle = async () => {
        const next = !evaluation.published;
        if (next) {
            const done = new Set(evaluation.grades.filter((g) => g.absent || g.score !== null).map((g) => g.studentId));
            const missing = studentIds.filter((id) => !done.has(id)).length;
            if (missing > 0 && !window.confirm(`${missing} élève(s) sans note. Publier quand même ?`)) return;
        }
        setBusy(true);
        try {
            onChange(await client.setPublished(evaluation.id, next));
        } catch (err) {
            window.alert(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                evaluation.published
                    ? 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
        >
            {evaluation.published ? <EyeOff size={16} /> : <Eye size={16} />}
            {evaluation.published ? 'Dépublier' : 'Publier'}
        </button>
    );
}
