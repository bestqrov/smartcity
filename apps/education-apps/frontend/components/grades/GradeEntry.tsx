'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2, MessageSquare } from 'lucide-react';
import type { EvaluationWithGrades, Grade, GradeInput, GradesClient, GradeStudent } from '@/lib/services/grades';
import { apiErrorMessage } from '@/lib/services/grades';
import { formatNum, parseScore, sortStudents } from './utils';

interface Row {
    score: string;
    absent: boolean;
    comment: string;
}

interface Props {
    client: GradesClient;
    evaluation: EvaluationWithGrades;
    students: GradeStudent[];
    /** Called with the evaluation's full grade list after each successful save. */
    onGradesSaved: (grades: Grade[]) => void;
    /** Reports whether some rows hold invalid values (they are never saved). */
    onInvalidChange?: (hasInvalid: boolean) => void;
}

type Status = 'idle' | 'saving' | 'saved' | 'error';

const rowFromGrade = (g?: Grade): Row => ({
    score: g && g.score !== null ? String(g.score).replace('.', ',') : '',
    absent: g?.absent ?? false,
    comment: g?.comment ?? '',
});

export default function GradeEntry({ client, evaluation, students, onGradesSaved, onInvalidChange }: Props) {
    const sorted = useMemo(() => sortStudents(students), [students]);
    const [rows, setRows] = useState<Record<string, Row>>(() => {
        const byStudent = new Map(evaluation.grades.map((g) => [g.studentId, g]));
        return Object.fromEntries(students.map((s) => [s.id, rowFromGrade(byStudent.get(s.id))]));
    });
    const [openComments, setOpenComments] = useState<Set<string>>(
        () => new Set(evaluation.grades.filter((g) => g.comment).map((g) => g.studentId)),
    );
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);

    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    const dirty = useRef<Set<string>>(new Set());
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlight = useRef(false);
    const evalId = evaluation.id;
    const maxScore = evaluation.maxScore;
    const onSavedRef = useRef(onGradesSaved);
    onSavedRef.current = onGradesSaved;

    const rowError = useCallback(
        (r: Row): string | null => {
            if (r.absent) return null;
            const v = parseScore(r.score);
            if (v === null) return null;
            if (Number.isNaN(v)) return 'Note invalide';
            if (v < 0 || v > maxScore) return `Entre 0 et ${formatNum(maxScore)}`;
            return null;
        },
        [maxScore],
    );

    const flush = useCallback(async () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        if (inFlight.current || dirty.current.size === 0) return;
        const payload: GradeInput[] = [];
        const sent: string[] = [];
        dirty.current.forEach((id) => {
            const r = rowsRef.current[id];
            if (!r || rowError(r)) return; // invalid rows stay dirty until fixed
            payload.push({
                studentId: id,
                absent: r.absent,
                score: r.absent ? null : parseScore(r.score),
                comment: r.comment.trim() ? r.comment.trim() : null,
            });
            sent.push(id);
        });
        if (!payload.length) return;
        sent.forEach((id) => dirty.current.delete(id));
        inFlight.current = true;
        setStatus('saving');
        try {
            for (let i = 0; i < payload.length; i += 500) {
                const grades = await client.saveGrades(evalId, payload.slice(i, i + 500));
                onSavedRef.current(grades);
            }
            setStatus('saved');
            setError(null);
        } catch (err) {
            sent.forEach((id) => dirty.current.add(id));
            setStatus('error');
            setError(apiErrorMessage(err, 'Échec de l’enregistrement'));
        } finally {
            inFlight.current = false;
        }
        // Edits made while the request was in flight.
        if (dirty.current.size && !timer.current) timer.current = setTimeout(() => void flush(), 1000);
    }, [client, evalId, rowError]);

    const schedule = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 1000);
    }, [flush]);

    // Save pending edits when leaving the screen.
    useEffect(() => () => void flush(), [flush]);

    const hasInvalid = sorted.some((s) => rowError(rows[s.id] ?? rowFromGrade()) !== null);
    const onInvalidRef = useRef(onInvalidChange);
    onInvalidRef.current = onInvalidChange;
    useEffect(() => {
        onInvalidRef.current?.(hasInvalid);
    }, [hasInvalid]);
    useEffect(() => () => onInvalidRef.current?.(false), []);

    // Warn before closing/reloading the tab while edits are unsaved, invalid or being saved.
    const unsaved = hasInvalid || status === 'saving' || status === 'error' || dirty.current.size > 0;
    useEffect(() => {
        if (!unsaved) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [unsaved]);

    const update = (ids: string[], patch: (r: Row) => Row) => {
        setRows((prev) => {
            const next = { ...prev };
            ids.forEach((id) => {
                next[id] = patch(prev[id] ?? rowFromGrade());
            });
            rowsRef.current = next;
            return next;
        });
        ids.forEach((id) => dirty.current.add(id));
        schedule();
    };

    const allIds = sorted.map((s) => s.id);
    const scoredCount = sorted.filter((s) => {
        const r = rows[s.id];
        return r && (r.absent || r.score.trim() !== '');
    }).length;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    {scoredCount}/{sorted.length} saisies · barème /{formatNum(maxScore)}
                </p>
                <div className="flex items-center gap-2 text-sm">
                    {status === 'saving' && (
                        <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 size={14} className="animate-spin" /> Enregistrement…</span>
                    )}
                    {status === 'saved' && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check size={14} /> Enregistré</span>
                    )}
                    {status === 'error' && (
                        <button type="button" onClick={() => void flush()} className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                            <AlertCircle size={14} /> {error} — Réessayer
                        </button>
                    )}
                </div>
            </div>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => window.confirm('Marquer tous les élèves sans note comme absents ?') &&
                        update(allIds.filter((id) => !rows[id]?.absent && !rows[id]?.score.trim()), (r) => ({ ...r, absent: true, score: '' }))}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                    Tous absents
                </button>
                <button
                    type="button"
                    onClick={() => window.confirm('Effacer toutes les notes de cette évaluation ?') &&
                        update(allIds, (r) => ({ ...r, absent: false, score: '' }))}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                    Effacer
                </button>
            </div>
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                {sorted.map((s) => {
                    const r = rows[s.id] ?? rowFromGrade();
                    const err = rowError(r);
                    return (
                        <li key={s.id} className="p-3">
                            <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium text-slate-900 dark:text-white">
                                        {s.surname} {s.name}
                                    </p>
                                    {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
                                </div>
                                <input
                                    inputMode="decimal"
                                    autoComplete="off"
                                    aria-label={`Note de ${s.name} ${s.surname}`}
                                    value={r.absent ? '' : r.score}
                                    disabled={r.absent}
                                    placeholder={r.absent ? 'Abs' : '—'}
                                    onChange={(e) => update([s.id], (row) => ({ ...row, score: e.target.value.replace(/[^\d.,]/g, '') }))}
                                    onBlur={() => void flush()}
                                    className={`w-20 rounded-xl border px-2 py-2 text-center text-lg font-semibold focus:outline-none focus:ring-2 disabled:bg-slate-100 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-700 ${
                                        err ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500 dark:border-slate-600'
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => update([s.id], (row) => ({ ...row, absent: !row.absent, score: !row.absent ? '' : row.score }))}
                                    className={`rounded-xl px-2.5 py-2 text-xs font-semibold ${
                                        r.absent
                                            ? 'bg-amber-500 text-white'
                                            : 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    Abs
                                </button>
                                <button
                                    type="button"
                                    aria-label="Commentaire"
                                    onClick={() => setOpenComments((prev) => {
                                        const n = new Set(prev);
                                        if (n.has(s.id)) n.delete(s.id);
                                        else n.add(s.id);
                                        return n;
                                    })}
                                    className={`rounded-xl p-2 ${r.comment ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}
                                >
                                    <MessageSquare size={16} />
                                </button>
                            </div>
                            {openComments.has(s.id) && (
                                <input
                                    value={r.comment}
                                    maxLength={500}
                                    placeholder="Commentaire (optionnel)"
                                    onChange={(e) => update([s.id], (row) => ({ ...row, comment: e.target.value }))}
                                    onBlur={() => void flush()}
                                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                                />
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
