'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { groupsService } from '@/lib/services/groups';
import { getGradingPeriods, staffGradesClient, apiErrorMessage, type EvaluationWithGrades, type GradeStudent } from '@/lib/services/grades';
import GroupEvaluations from './GroupEvaluations';
import BulletinTab from './BulletinTab';
import { sortStudents } from './utils';

interface GroupOption {
    id: string;
    name: string;
    subject?: string;
    students?: GradeStudent[];
}

/** Staff grades page (admin + secretary): group picker, evaluations, bulletin. */
export default function GradesWorkspace() {
    const [groups, setGroups] = useState<GroupOption[]>([]);
    const [periods, setPeriods] = useState<string[]>([]);
    const [groupId, setGroupId] = useState('');
    const [tab, setTab] = useState<'evaluations' | 'bulletin'>('evaluations');
    const [evaluations, setEvaluationsState] = useState<EvaluationWithGrades[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([groupsService.getAll(), getGradingPeriods()])
            .then(([g, p]: [GroupOption[], string[]]) => {
                setGroups(g);
                setPeriods(p);
            })
            .catch((err) => setError(apiErrorMessage(err)))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!groupId) return;
        let cancelled = false;
        setEvaluationsState([]);
        staffGradesClient
            .listEvaluations(groupId)
            .then((e) => !cancelled && setEvaluationsState(e))
            .catch((err) => !cancelled && setError(apiErrorMessage(err)));
        return () => {
            cancelled = true;
        };
    }, [groupId]);

    const setEvaluations = useCallback(
        (updater: (prev: EvaluationWithGrades[]) => EvaluationWithGrades[]) => setEvaluationsState(updater),
        [],
    );

    const group = groups.find((g) => g.id === groupId);
    const students = useMemo(() => sortStudents(group?.students ?? []), [group]);

    return (
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notes</h1>
            {loading ? (
                <Loader2 className="animate-spin text-slate-400" />
            ) : (
                <>
                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    <select
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:w-80"
                    >
                        <option value="">Choisir un groupe…</option>
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                                {g.subject ? ` — ${g.subject}` : ''}
                            </option>
                        ))}
                    </select>
                    {group && (
                        <>
                            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 sm:w-fit">
                                {(['evaluations', 'bulletin'] as const).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setTab(t)}
                                        className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium ${
                                            tab === t
                                                ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
                                                : 'text-slate-600 dark:text-slate-300'
                                        }`}
                                    >
                                        {t === 'evaluations' ? 'Évaluations' : 'Bulletin'}
                                    </button>
                                ))}
                            </div>
                            {tab === 'evaluations' ? (
                                <GroupEvaluations
                                    key={group.id}
                                    client={staffGradesClient}
                                    groupId={group.id}
                                    groupSubject={group.subject}
                                    students={students}
                                    periods={periods}
                                    evaluations={evaluations}
                                    setEvaluations={setEvaluations}
                                />
                            ) : (
                                <BulletinTab groupId={group.id} groupName={group.name} periods={periods} evaluations={evaluations} />
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
