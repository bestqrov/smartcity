'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Eye, EyeOff, Loader2, MapPin, Pencil, PartyPopper, Plus, Trash2, Users } from 'lucide-react';
import { activitiesService, type Activity, type ActivityWithCounts } from '@/lib/services/activities';
import { apiErrorMessage } from '@/lib/services/grades';
import ActivityForm from './ActivityForm';
import ActivityDetail from './ActivityDetail';
import { fmtDateTime, isPast } from './utils';

export default function ActivitiesManager() {
    const [items, setItems] = useState<ActivityWithCounts[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
    const [form, setForm] = useState<{ activity: Activity | null } | null>(null);
    const [openId, setOpenId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setItems(await activitiesService.list());
            setError(null);
        } catch (e) {
            setError(apiErrorMessage(e));
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const togglePublish = async (a: ActivityWithCounts) => {
        if (!a.published && !window.confirm('Publier cette activité ? Les parents concernés seront notifiés.')) return;
        setBusyId(a.id);
        try {
            const upd = await activitiesService.setPublished(a.id, !a.published);
            setItems((p) => p?.map((x) => (x.id === a.id ? { ...x, ...upd } : x)) ?? p);
        } catch (e) {
            window.alert(apiErrorMessage(e));
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (a: ActivityWithCounts) => {
        if (!window.confirm(`Supprimer « ${a.title} » et toutes les réponses ?`)) return;
        setBusyId(a.id);
        try {
            await activitiesService.remove(a.id);
            setItems((p) => p?.filter((x) => x.id !== a.id) ?? p);
        } catch (e) {
            window.alert(apiErrorMessage(e));
        } finally {
            setBusyId(null);
        }
    };

    const open = items?.find((a) => a.id === openId) ?? null;
    if (open) {
        return (
            <div className="mx-auto max-w-5xl p-4 sm:p-6">
                <ActivityDetail activity={open} onBack={() => setOpenId(null)} onCountsChange={load} />
            </div>
        );
    }

    const now = Date.now();
    const upcoming = (items ?? []).filter((a) => !isPast(a, now)).sort((a, b) => a.startAt.localeCompare(b.startAt));
    const past = (items ?? []).filter((a) => isPast(a, now));
    const list = view === 'upcoming' ? upcoming : past;

    return (
        <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                    <PartyPopper className="text-pink-500" /> Activités
                </h1>
                <button
                    type="button"
                    onClick={() => setForm({ activity: null })}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 sm:w-auto"
                >
                    <Plus size={18} /> Nouvelle activité
                </button>
            </div>
            <div className="flex gap-2">
                {(
                    [
                        ['upcoming', `À venir (${upcoming.length})`],
                        ['past', `Passées (${past.length})`],
                    ] as const
                ).map(([id, lbl]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setView(id)}
                        aria-pressed={view === id}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                            view === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                    >
                        {lbl}
                    </button>
                ))}
            </div>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
            {!items && !error && <Loader2 className="mx-auto animate-spin text-slate-400" />}
            {items && list.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {view === 'upcoming' ? 'Aucune activité à venir.' : 'Aucune activité passée.'}
                </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((a) => (
                    <article key={a.id} className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                        <button type="button" onClick={() => setOpenId(a.id)} className="text-start">
                            {a.coverImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.coverImage} alt="" className="h-36 w-full object-cover" />
                            ) : (
                                <div className="flex h-24 items-center justify-center bg-gradient-to-br from-pink-500 to-violet-600 text-white">
                                    <PartyPopper size={32} />
                                </div>
                            )}
                            <div className="space-y-1 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">{a.title}</h3>
                                    <span
                                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            a.published
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        {a.published ? 'Publiée' : 'Brouillon'}
                                    </span>
                                </div>
                                <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                    <CalendarDays size={13} /> {fmtDateTime(a.startAt)}
                                </p>
                                {a.location && (
                                    <p className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
                                        <MapPin size={13} /> {a.location}
                                    </p>
                                )}
                                <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                    <Users size={13} /> {a.audience === 'ALL' ? 'Tous les élèves' : `${a.groupIds.length} groupe(s)`} · {a.counts.targeted} élève(s)
                                    {a.price ? ` · ${a.price} MAD` : ''}
                                </p>
                                {a.needsConsent && (
                                    <div className="flex flex-wrap gap-1 pt-1 text-xs">
                                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Oui {a.counts.yes}</span>
                                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Non {a.counts.no}</span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">? {a.counts.noAnswer}</span>
                                        {(a.price ?? 0) > 0 && (
                                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">Payé {a.counts.paid}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </button>
                        <div className="mt-auto flex border-t border-slate-100 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => togglePublish(a)}
                                disabled={busyId === a.id}
                                className="flex flex-1 items-center justify-center gap-1 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                                {a.published ? <EyeOff size={14} /> : <Eye size={14} />} {a.published ? 'Dépublier' : 'Publier'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ activity: a })}
                                aria-label="Modifier"
                                className="px-4 py-2 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(a)}
                                disabled={busyId === a.id}
                                aria-label="Supprimer"
                                className="px-4 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </article>
                ))}
            </div>
            {form && (
                <ActivityForm
                    activity={form.activity}
                    onClose={() => setForm(null)}
                    onSaved={() => {
                        setForm(null);
                        load();
                    }}
                />
            )}
        </div>
    );
}
