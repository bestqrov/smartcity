'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { groupsService } from '@/lib/services/groups';
import { staffHomeworkClient, type Homework } from '@/lib/services/homework';
import { apiErrorMessage } from '@/lib/services/grades';
import HomeworkList from './HomeworkList';

interface GroupOption {
    id: string;
    name: string;
    subject?: string;
}

/** Staff homework page (admin + secretary): group picker + list. */
export default function HomeworkWorkspace() {
    const [groups, setGroups] = useState<GroupOption[] | null>(null);
    const [groupId, setGroupId] = useState('');
    const [homework, setHomework] = useState<Homework[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        groupsService
            .getAll()
            .then((g: GroupOption[]) => setGroups(g || []))
            .catch((err) => {
                setGroups([]);
                setError(apiErrorMessage(err));
            });
    }, []);

    useEffect(() => {
        if (!groupId) return;
        let cancelled = false;
        setHomework(null);
        staffHomeworkClient
            .list(groupId)
            .then((h) => !cancelled && setHomework(h))
            .catch((err) => !cancelled && setError(apiErrorMessage(err)));
        return () => {
            cancelled = true;
        };
    }, [groupId]);

    const group = groups?.find((g) => g.id === groupId);

    return (
        <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                <BookOpen className="text-teal-500" /> Devoirs
            </h1>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {!groups ? (
                <Loader2 className="animate-spin text-slate-400" />
            ) : (
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
            )}
            {group &&
                (homework ? (
                    <HomeworkList
                        key={group.id}
                        client={staffHomeworkClient}
                        groupId={group.id}
                        groupSubject={group.subject}
                        homework={homework}
                        setHomework={(u) => setHomework((p) => u(p ?? []))}
                    />
                ) : (
                    <Loader2 className="animate-spin text-slate-400" />
                ))}
        </div>
    );
}
