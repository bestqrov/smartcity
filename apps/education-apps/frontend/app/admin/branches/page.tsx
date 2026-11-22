'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createBranch, getBranchSummary, type Branch, type BranchSummary, type NewBranch } from '@/lib/services/branches';
import { branchLimitDetails, getSchoolCapacity, type SchoolCapacity } from '@/lib/services/subscription';
import { apiErrorMessage } from '@/lib/services/packs';
import { askForUpgrade } from '@/lib/packs/upgradeBus';
import useAuthStore, { setActiveBranchId } from '@/store/useAuthStore';

import { useI18n } from '@/lib/i18n/I18nProvider';
const EMPTY: NewBranch = { name: '', city: '', address: '', phone: '' };

const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-white';

export default function BranchesSummaryPage() {
    const { tr } = useI18n();
    const router = useRouter();
    const isOwner = useAuthStore((state) => state.user?.role) === 'OWNER';
    const [summary, setSummary] = useState<BranchSummary | null>(null);
    const [capacity, setCapacity] = useState<SchoolCapacity | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState<NewBranch>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [created, setCreated] = useState<Branch | null>(null);

    const load = useCallback(async () => {
        try {
            setSummary(await getBranchSummary());
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
        // Capacity needs an active branch; the counter is simply hidden if it cannot load.
        getSchoolCapacity().then(setCapacity).catch(() => setCapacity(null));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleOpenBranch = (branchId: string) => {
        setActiveBranchId(branchId);
        router.push('/admin');
    };

    const closeForm = () => {
        if (saving) return;
        setFormOpen(false);
        setForm(EMPTY);
        setFormError('');
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const name = form.name.trim();
        if (name.length < 2 || name.length > 80) {
            setFormError(tr("Le nom doit contenir entre 2 et 80 caractères."));
            return;
        }
        const payload: NewBranch = { name };
        if (form.city?.trim()) payload.city = form.city.trim();
        if (form.address?.trim()) payload.address = form.address.trim();
        if (form.phone?.trim()) payload.phone = form.phone.trim();

        setSaving(true);
        setFormError('');
        try {
            // A full pack opens the upgrade dialog; after an upgrade the same request is sent again.
            for (;;) {
                try {
                    const branch = await createBranch(payload);
                    setCreated(branch);
                    setFormOpen(false);
                    setForm(EMPTY);
                    await load();
                    return;
                } catch (err) {
                    const details = branchLimitDetails(err);
                    if (!details) throw err;
                    const upgraded = await askForUpgrade(details);
                    if (!upgraded) {
                        setFormError(tr("Limite d’établissements de votre pack atteinte."));
                        return;
                    }
                }
            }
        } catch (err) {
            setFormError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-6">{tr("Chargement…")}</div>;
    if (error) return <div className="p-6 text-red-600">{tr("Impossible de charger le résumé des établissements.")}</div>;
    if (!summary) return <div className="p-6">{tr("Aucune donnée")}</div>;

    const used = capacity?.branches;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{tr("Vue d'ensemble — tous les établissements")}</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {summary.totalStudents}{' '}{tr("élèves au total — solde dû combiné:")}{' '}{summary.totalBalanceDue}{tr("MAD")}</p>
                    {used && (
                        <p className="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                            {used.current} / {used.limit === null ? '∞' : used.limit}{tr("établissements utilisés")}</p>
                    )}
                </div>
                {isOwner && (
                    <button
                        type="button"
                        onClick={() => setFormOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-2.5 font-semibold text-white shadow-md transition hover:brightness-110 sm:w-auto"
                    >
                        <Plus className="h-4 w-4" />{tr("Ajouter un établissement")}</button>
                )}
            </div>

            {created && (
                <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800 dark:bg-emerald-900/30">
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">{tr("L'établissement")}<strong>« {created.name} »</strong>{tr("a été créé.")}</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => handleOpenBranch(created.id)}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        >{tr("Basculer vers cet établissement")}</button>
                        <button type="button" onClick={() => setCreated(null)} aria-label={tr("Fermer")} className="text-emerald-700 dark:text-emerald-300">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {summary.branches.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400">{tr("Aucun établissement pour le moment.")}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {summary.branches.map(({ branch, studentCount, presentToday, balanceDue }) => (
                    <button
                        key={branch.id}
                        onClick={() => handleOpenBranch(branch.id)}
                        className="rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 p-5 text-start transition-colors hover:border-blue-400 dark:hover:border-blue-500"
                    >
                        <p className="font-semibold text-slate-900 dark:text-white">{branch.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{branch.city}</p>
                        <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            <p>{tr("Élèves:")}{' '}{studentCount}</p>
                            <p>{tr("Présents aujourd'hui:")}{' '}{presentToday}</p>
                            <p>{tr("Solde dû:")}{' '}{balanceDue}{' '}{tr("MAD")}</p>
                        </div>
                    </button>
                ))}
            </div>

            {formOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="add-branch-title"
                    onClick={(event) => event.target === event.currentTarget && closeForm()}
                >
                    <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-slate-800">
                        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-5 py-4">
                            <h2 id="add-branch-title" className="text-lg font-bold text-white">{tr("Ajouter un établissement")}</h2>
                            <button type="button" onClick={closeForm} disabled={saving} aria-label={tr("Fermer")} className="text-white/80 hover:text-white">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-3 p-5">
                            {([
                                ['name', 'Nom *', 80],
                                ['city', 'Ville', 60],
                                ['address', 'Adresse', 200],
                                ['phone', 'Téléphone', 20],
                            ] as const).map(([key, label, max]) => (
                                <label key={key} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                                    {label}
                                    <input
                                        className={`${inputClass} mt-1`}
                                        type={key === 'phone' ? 'tel' : 'text'}
                                        maxLength={max}
                                        required={key === 'name'}
                                        minLength={key === 'name' ? 2 : undefined}
                                        value={form[key] ?? ''}
                                        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                                    />
                                </label>
                            ))}
                            {formError && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{tr(formError)}</p>}
                        </div>
                        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 p-5 dark:border-slate-700">
                            <button type="button" onClick={closeForm} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">{tr("Annuler")}</button>
                            <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                                {saving ? tr("Création…") : tr("Créer")}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
