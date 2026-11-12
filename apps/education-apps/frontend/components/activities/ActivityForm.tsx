'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react';
import { groupsService } from '@/lib/services/groups';
import { activitiesService, resizeCover, type Activity, type ActivityAudience, type ActivityInput } from '@/lib/services/activities';
import { apiErrorMessage } from '@/lib/services/grades';

interface Props {
    activity: Activity | null;
    onClose: () => void;
    onSaved: (a: Activity) => void;
}

/** ISO → value for <input type="datetime-local"> (local time). */
const toLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const input =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const label = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300';

export default function ActivityForm({ activity, onClose, onSaved }: Props) {
    const [title, setTitle] = useState(activity?.title ?? '');
    const [description, setDescription] = useState(activity?.description ?? '');
    const [startAt, setStartAt] = useState(toLocalInput(activity?.startAt));
    const [endAt, setEndAt] = useState(toLocalInput(activity?.endAt));
    const [location, setLocation] = useState(activity?.location ?? '');
    const [price, setPrice] = useState(activity?.price != null ? String(activity.price) : '');
    const [needsConsent, setNeedsConsent] = useState(activity?.needsConsent ?? true);
    const [deadline, setDeadline] = useState(toLocalInput(activity?.deadline));
    const [audience, setAudience] = useState<ActivityAudience>(activity?.audience ?? 'ALL');
    const [groupIds, setGroupIds] = useState<string[]>(activity?.groupIds ?? []);
    const [cover, setCover] = useState<string | null>(activity?.coverImage ?? null);
    const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        groupsService
            .getAll()
            .then((g: { id: string; name: string }[]) => setGroups(g || []))
            .catch(() => setGroups([]));
    }, []);

    const pickCover = async (file?: File) => {
        if (!file) return;
        setError(null);
        try {
            setCover(await resizeCover(file));
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!title.trim() || !startAt) return setError('Titre et date de début obligatoires.');
        if (endAt && endAt < startAt) return setError('La fin doit être après le début.');
        if (deadline && deadline > startAt) return setError('La date limite doit précéder le début.');
        if (audience === 'GROUPS' && groupIds.length === 0) return setError('Choisissez au moins un groupe.');
        const priceNum = price.trim() ? Number(price.replace(',', '.')) : null;
        if (priceNum != null && (!Number.isFinite(priceNum) || priceNum < 0)) return setError('Prix invalide.');
        const body: ActivityInput = {
            title: title.trim(),
            description: description.trim() || null,
            startAt: fromLocalInput(startAt)!,
            endAt: fromLocalInput(endAt),
            location: location.trim() || null,
            price: priceNum,
            needsConsent,
            deadline: needsConsent ? fromLocalInput(deadline) : null,
            audience,
            groupIds: audience === 'GROUPS' ? groupIds : [],
            coverImage: cover,
        };
        setBusy(true);
        try {
            onSaved(activity ? await activitiesService.update(activity.id, body) : await activitiesService.create(body));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true">
            <form
                onSubmit={submit}
                className="flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white dark:bg-slate-800 sm:rounded-2xl"
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <h2 className="font-semibold text-slate-900 dark:text-white">{activity ? 'Modifier l’activité' : 'Nouvelle activité'}</h2>
                    <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    <div>
                        {cover ? (
                            <div className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={cover} alt="" className="h-40 w-full rounded-xl object-cover" />
                                <button
                                    type="button"
                                    onClick={() => setCover(null)}
                                    aria-label="Retirer l’image"
                                    className="absolute end-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400"
                            >
                                <ImagePlus size={22} /> Image de couverture
                            </button>
                        )}
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={(e) => {
                                pickCover(e.target.files?.[0]);
                                e.target.value = '';
                            }}
                        />
                    </div>
                    <div>
                        <label className={label}>Titre *</label>
                        <input className={input} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} required />
                    </div>
                    <div>
                        <label className={label}>Description</label>
                        <textarea className={input} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className={label}>Début *</label>
                            <input type="datetime-local" className={input} value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
                        </div>
                        <div>
                            <label className={label}>Fin</label>
                            <input type="datetime-local" className={input} value={endAt} min={startAt || undefined} onChange={(e) => setEndAt(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className={label}>Lieu</label>
                            <input className={input} maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} />
                        </div>
                        <div>
                            <label className={label}>Prix (MAD)</label>
                            <input className={input} inputMode="decimal" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Gratuit" />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input type="checkbox" checked={needsConsent} onChange={(e) => setNeedsConsent(e.target.checked)} className="h-4 w-4" />
                        Demander l’accord des parents (Oui / Non)
                    </label>
                    {needsConsent && (
                        <div>
                            <label className={label}>Date limite de réponse</label>
                            <input type="datetime-local" className={input} value={deadline} max={startAt || undefined} onChange={(e) => setDeadline(e.target.value)} />
                        </div>
                    )}
                    <div>
                        <span className={label}>Concerne</span>
                        <div className="flex gap-2">
                            {(['ALL', 'GROUPS'] as const).map((a) => (
                                <button
                                    key={a}
                                    type="button"
                                    onClick={() => setAudience(a)}
                                    aria-pressed={audience === a}
                                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
                                        audience === a ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    {a === 'ALL' ? 'Tous les élèves' : 'Certains groupes'}
                                </button>
                            ))}
                        </div>
                        {audience === 'GROUPS' && (
                            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                                {groups.length === 0 && <p className="p-2 text-sm text-slate-500">Aucun groupe.</p>}
                                {groups.map((g) => (
                                    <label key={g.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={groupIds.includes(g.id)}
                                            onChange={(e) => setGroupIds((p) => (e.target.checked ? [...p, g.id] : p.filter((x) => x !== g.id)))}
                                            className="h-4 w-4"
                                        />
                                        {g.name}
                                    </label>
                                ))}
                            </div>
                        )}
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
