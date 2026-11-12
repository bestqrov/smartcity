'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import GroupEvaluations from '@/components/grades/GroupEvaluations';
import HomeworkList from '@/components/homework/HomeworkList';
import { teacherHomeworkClient, type Homework } from '@/lib/services/homework';
import { getTeacherPortal, teacherGradesClient, type EvaluationWithGrades, type TeacherPortal } from '@/lib/services/grades';
import { sortStudents } from '@/components/grades/utils';

export default function TeacherSpacePage({ params }: { params: { token: string } }) {
    const token = params.token;
    const client = useMemo(() => teacherGradesClient(token), [token]);
    const [portal, setPortal] = useState<TeacherPortal | null>(null);
    const [state, setState] = useState<'loading' | 'invalid' | 'rate' | 'error' | 'ready'>('loading');
    const [groupId, setGroupId] = useState<string | null>(null);
    const [tab, setTab] = useState<'evaluations' | 'homework'>('evaluations');
    const hwClient = useMemo(() => teacherHomeworkClient(token), [token]);

    useEffect(() => {
        let cancelled = false;
        getTeacherPortal(token)
            .then((p) => {
                if (cancelled) return;
                setPortal(p);
                setState('ready');
            })
            .catch((err) => {
                if (cancelled) return;
                const status = err?.response?.status;
                setState(status === 429 ? 'rate' : status === 404 || status === 400 ? 'invalid' : 'error');
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    const group = portal?.groups.find((g) => g.id === groupId) ?? null;
    const students = useMemo(() => (group ? sortStudents(group.students) : []), [group]);

    const setEvaluations = (updater: (prev: EvaluationWithGrades[]) => EvaluationWithGrades[]) =>
        setPortal((p) =>
            p ? { ...p, groups: p.groups.map((g) => (g.id === groupId ? { ...g, evaluations: updater(g.evaluations) } : g)) } : p,
        );

    const setHomework = (updater: (prev: Homework[]) => Homework[]) =>
        setPortal((p) =>
            p ? { ...p, groups: p.groups.map((g) => (g.id === groupId ? { ...g, homework: updater(g.homework ?? []) } : g)) } : p,
        );

    if (state === 'loading') {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="animate-spin text-slate-400" size={28} />
            </main>
        );
    }
    if (state !== 'ready' || !portal) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
                <div className="max-w-sm space-y-2">
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {state === 'invalid' ? 'Lien invalide' : state === 'rate' ? 'Trop de requêtes' : 'Connexion impossible'}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        {state === 'invalid'
                            ? 'Lien invalide, demandez un nouveau lien à l’établissement.'
                            : state === 'rate'
                            ? 'Trop de requêtes, réessayez dans une minute.'
                            : 'Vérifiez votre connexion internet puis rechargez la page.'}
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 pb-12 dark:bg-slate-950">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
                <div className="mx-auto flex max-w-2xl items-center gap-3">
                    {group ? (
                        <button type="button" onClick={() => setGroupId(null)} aria-label="Retour" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                            <ArrowLeft size={20} />
                        </button>
                    ) : portal.school?.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={portal.school.logo} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    ) : null}
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">{group ? group.name : portal.teacher.name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {group ? `${group.subject} · ${group.students.length} élèves` : portal.school?.name ?? 'Espace enseignant'}
                        </p>
                    </div>
                </div>
            </header>
            <div className="mx-auto max-w-2xl p-4">
                {group ? (
                    <div className="space-y-4">
                    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                        {(['evaluations', 'homework'] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTab(t)}
                                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                                    tab === t ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-300'
                                }`}
                            >
                                {t === 'evaluations' ? 'Évaluations' : 'Devoirs'}
                            </button>
                        ))}
                    </div>
                    {tab === 'homework' ? (
                    <HomeworkList
                        key={`hw-${group.id}`}
                        client={hwClient}
                        groupId={group.id}
                        groupSubject={group.subject}
                        homework={group.homework ?? []}
                        setHomework={setHomework}
                    />
                    ) : (
                    <GroupEvaluations
                        key={group.id}
                        client={client}
                        groupId={group.id}
                        groupSubject={group.subject}
                        students={students}
                        periods={portal.periods}
                        evaluations={group.evaluations}
                        setEvaluations={setEvaluations}
                    />
                    )}
                    </div>
                ) : portal.groups.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Aucun groupe ne vous est attribué.
                    </p>
                ) : (
                    <ul className="space-y-3">
                        <li className="text-sm font-medium text-slate-600 dark:text-slate-300">Vos groupes</li>
                        {portal.groups.map((g) => (
                            <li key={g.id}>
                                <button
                                    type="button"
                                    onClick={() => setGroupId(g.id)}
                                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left dark:border-slate-700 dark:bg-slate-800"
                                >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                                        <Users size={20} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-slate-900 dark:text-white">{g.name}</p>
                                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                            {[g.subject, g.level].filter(Boolean).join(' · ')} · {g.students.length} élèves · {g.evaluations.length} évaluation(s)
                                        </p>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-400" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </main>
    );
}
