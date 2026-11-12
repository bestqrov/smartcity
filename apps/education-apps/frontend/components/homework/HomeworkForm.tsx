'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { Homework, HomeworkClient } from '@/lib/services/homework';
import { apiErrorMessage } from '@/lib/services/grades';

interface Props {
    client: HomeworkClient;
    groupId: string;
    defaultSubject?: string;
    homework: Homework | null;
    onClose: () => void;
    onSaved: (h: Homework) => void;
}

const input =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const label = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300';

const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
};

export default function HomeworkForm({ client, groupId, defaultSubject, homework, onClose, onSaved }: Props) {
    const [title, setTitle] = useState(homework?.title ?? '');
    const [subject, setSubject] = useState(homework?.subject ?? defaultSubject ?? '');
    const [details, setDetails] = useState(homework?.details ?? '');
    const [dueDate, setDueDate] = useState(homework?.dueDate.slice(0, 10) ?? tomorrow());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !dueDate) return setError('Titre et date obligatoires.');
        setBusy(true);
        setError(null);
        const body = { groupId, title: title.trim(), subject: subject.trim() || null, details: details.trim() || null, dueDate };
        try {
            onSaved(homework ? await client.update(homework.id, body) : await client.create(body));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
            <form onSubmit={submit} className="flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white dark:bg-slate-800 sm:rounded-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <h2 className="font-semibold text-slate-900 dark:text-white">{homework ? 'Modifier le devoir' : 'Nouveau devoir'}</h2>
                    <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                        <label className={label}>Titre *</label>
                        <input className={input} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className={label}>Matière</label>
                            <input className={input} value={subject} maxLength={100} onChange={(e) => setSubject(e.target.value)} />
                        </div>
                        <div>
                            <label className={label}>Pour le *</label>
                            <input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                        </div>
                    </div>
                    <div>
                        <label className={label}>Détails</label>
                        <textarea className={input} rows={4} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
                    </div>
                    {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
                </div>
                <div className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
                    <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-slate-100 py-2.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        Annuler
                    </button>
                    <button type="submit" disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 font-semibold text-white disabled:opacity-60">
                        {busy && <Loader2 size={16} className="animate-spin" />} Enregistrer
                    </button>
                </div>
            </form>
        </div>
    );
}
