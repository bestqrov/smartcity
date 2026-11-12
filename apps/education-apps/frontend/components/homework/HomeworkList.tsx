'use client';

import { useState } from 'react';
import { BookOpen, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Homework, HomeworkClient } from '@/lib/services/homework';
import { apiErrorMessage } from '@/lib/services/grades';
import HomeworkForm from './HomeworkForm';

interface Props {
    client: HomeworkClient;
    groupId: string;
    groupSubject?: string;
    homework: Homework[];
    /** State lives with the caller; updated from mutation responses only. */
    setHomework: (updater: (prev: Homework[]) => Homework[]) => void;
}

const fmt = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A group's homework list (staff or teacher), upcoming first then past. */
export default function HomeworkList({ client, groupId, groupSubject, homework, setHomework }: Props) {
    const [form, setForm] = useState<{ homework: Homework | null } | null>(null);
    const today = todayKey();
    const upcoming = homework.filter((h) => h.dueDate.slice(0, 10) >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const past = homework.filter((h) => h.dueDate.slice(0, 10) < today).sort((a, b) => b.dueDate.localeCompare(a.dueDate));

    const remove = async (h: Homework) => {
        if (!window.confirm(`Supprimer le devoir « ${h.title} » ?`)) return;
        try {
            await client.remove(h.id);
            setHomework((p) => p.filter((x) => x.id !== h.id));
        } catch (err) {
            window.alert(apiErrorMessage(err));
        }
    };

    const renderItem = (h: Homework, dim = false) => (
        <li key={h.id} className={`rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 ${dim ? 'opacity-60' : ''}`}>
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{h.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                            <CalendarDays size={12} /> {fmt(h.dueDate)}
                        </span>
                        {h.subject && <span>· {h.subject}</span>}
                    </p>
                    {h.details && <p className="mt-1 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{h.details}</p>}
                </div>
                <button type="button" onClick={() => setForm({ homework: h })} aria-label="Modifier" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                    <Pencil size={16} />
                </button>
                <button type="button" onClick={() => remove(h)} aria-label="Supprimer" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                    <Trash2 size={16} />
                </button>
            </div>
        </li>
    );

    return (
        <div className="space-y-4">
            <button
                type="button"
                onClick={() => setForm({ homework: null })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 sm:w-auto sm:px-4"
            >
                <Plus size={18} /> Nouveau devoir
            </button>
            {homework.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <BookOpen size={24} /> Aucun devoir pour ce groupe.
                </div>
            ) : (
                <>
                    {upcoming.length > 0 && <ul className="space-y-2">{upcoming.map((h) => renderItem(h))}</ul>}
                    {past.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Passés</p>
                            <ul className="space-y-2">{past.map((h) => renderItem(h, true))}</ul>
                        </div>
                    )}
                </>
            )}
            {form && (
                <HomeworkForm
                    client={client}
                    groupId={groupId}
                    defaultSubject={groupSubject}
                    homework={form.homework}
                    onClose={() => setForm(null)}
                    onSaved={(h) => {
                        setHomework((p) => (p.some((x) => x.id === h.id) ? p.map((x) => (x.id === h.id ? h : x)) : [...p, h]));
                        setForm(null);
                    }}
                />
            )}
        </div>
    );
}
