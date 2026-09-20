'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, Star } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import { INSTITUTION_TYPES, INSTITUTION_TYPE_LABELS, type InstitutionType } from '@/lib/institutionTypes';
import { PACK_FEATURES, type PackFeature } from '@/lib/packs';
import {
    apiErrorMessage,
    createPack,
    getAllPacks,
    setDefaultPack,
    updatePack,
    type AdminPack,
    type PackFormInput,
} from '@/lib/services/packs';

interface FormState {
    name: string;
    code: string;
    monthlyPrice: string;
    yearlyPrice: string;
    maxStudents: string; // empty = unlimited
    maxBranches: string; // empty = unlimited
    sortOrder: string;
    features: PackFeature[];
    institutionTypes: InstitutionType[];
    active: boolean;
}

const emptyForm: FormState = {
    name: '',
    code: '',
    monthlyPrice: '',
    yearlyPrice: '',
    maxStudents: '',
    maxBranches: '',
    sortOrder: '0',
    features: [],
    institutionTypes: [],
    active: true,
};

const toForm = (pack: AdminPack): FormState => ({
    name: pack.name,
    code: pack.code,
    monthlyPrice: String(pack.monthlyPrice),
    yearlyPrice: String(pack.yearlyPrice),
    maxStudents: pack.maxStudents === null ? '' : String(pack.maxStudents),
    maxBranches: pack.maxBranches === null ? '' : String(pack.maxBranches),
    sortOrder: String(pack.sortOrder),
    features: pack.features,
    institutionTypes: pack.institutionTypes,
    active: pack.active,
});

const toInput = (form: FormState): PackFormInput => ({
    name: form.name,
    code: form.code,
    monthlyPrice: Number(form.monthlyPrice),
    yearlyPrice: Number(form.yearlyPrice),
    maxStudents: form.maxStudents.trim() === '' ? null : Number(form.maxStudents),
    maxBranches: form.maxBranches.trim() === '' ? null : Number(form.maxBranches),
    sortOrder: Number(form.sortOrder || 0),
    features: form.features,
    institutionTypes: form.institutionTypes,
    active: form.active,
});

const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const inputCls =
    'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';
const labelCls = 'block text-xs font-medium text-gray-500 mb-1';

export default function SuperAdminPacksPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<AdminPack | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setPacks(await getAllPacks());
        } catch (e) {
            setError(apiErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') {
            router.push('/admin');
            return;
        }
        if (user?.role === 'SUPER_ADMIN') load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setError('');
        setModalOpen(true);
    };

    const openEdit = (pack: AdminPack) => {
        setEditing(pack);
        setForm(toForm(pack));
        setError('');
        setModalOpen(true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        setError('');
        try {
            const input = toInput(form);
            if (editing) await updatePack(editing.id, input);
            else await createPack(input);
            setModalOpen(false);
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const runOn = async (id: string, action: () => Promise<unknown>) => {
        setBusyId(id);
        setError('');
        try {
            await action();
            await load();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusyId(null);
        }
    };

    if (!user || user.role !== 'SUPER_ADMIN') return null;

    const limit = (value: number | null) => (value === null ? '∞' : value);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Packs</h1>
                    <p className="text-gray-600 mt-1">Catalogue des offres vendues aux établissements</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm"
                    >
                        <Plus size={16} /> Nouveau pack
                    </button>
                    <div className="bg-blue-100 p-3 rounded-lg">
                        <Package className="text-blue-600" size={32} />
                    </div>
                </div>
            </div>

            {error && !modalOpen && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-x-auto">
                {loading ? (
                    <p className="p-8 text-gray-500">Chargement…</p>
                ) : packs.length === 0 ? (
                    <p className="p-8 text-gray-500">
                        Aucun pack. Exécutez <code>npm run prisma:seed-packs</code> ou créez-en un.
                    </p>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                            <tr>
                                <th className="px-4 py-3">Pack</th>
                                <th className="px-4 py-3">Prix (MAD)</th>
                                <th className="px-4 py-3">Limites</th>
                                <th className="px-4 py-3">Types</th>
                                <th className="px-4 py-3">Fonctionnalités</th>
                                <th className="px-4 py-3">Écoles</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packs.map((pack) => (
                                <tr key={pack.id} className="border-t border-gray-100 align-top text-sm">
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-gray-800 flex items-center gap-2">
                                            {pack.name}
                                            {pack.isDefault && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-bold">
                                                    <Star size={11} /> Par défaut
                                                </span>
                                            )}
                                            {!pack.active && (
                                                <span className="rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 text-[11px] font-bold">
                                                    Inactif
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-gray-400">{pack.code}</p>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {pack.monthlyPrice} / mois
                                        <br />
                                        <span className="text-gray-400">{pack.yearlyPrice} / an</span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">
                                        {limit(pack.maxStudents)} élèves
                                        <br />
                                        {limit(pack.maxBranches)} établissement(s)
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {pack.institutionTypes.map((type) => (
                                                <span key={type} className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[11px] font-semibold">
                                                    {INSTITUTION_TYPE_LABELS[type]}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {pack.features.length === 0 && <span className="text-gray-400">—</span>}
                                            {pack.features.map((feature) => (
                                                <span key={feature} className="rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[11px] font-semibold">
                                                    {PACK_FEATURES.find((f) => f.key === feature)?.label ?? feature}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-700">{pack._count?.schools ?? 0}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => openEdit(pack)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"
                                            >
                                                Modifier
                                            </button>
                                            {!pack.isDefault && pack.active && (
                                                <button
                                                    disabled={busyId === pack.id}
                                                    onClick={() => runOn(pack.id, () => setDefaultPack(pack.id))}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    Par défaut
                                                </button>
                                            )}
                                            {!pack.isDefault && (
                                                <button
                                                    disabled={busyId === pack.id}
                                                    onClick={() => runOn(pack.id, () => updatePack(pack.id, { active: !pack.active }))}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    {pack.active ? 'Désactiver' : 'Activer'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le pack' : 'Nouveau pack'} size="lg">
                <form onSubmit={save} className="space-y-4">
                    {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Nom</label>
                            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div>
                            <label className={labelCls}>Code (a-z, 0-9, -)</label>
                            <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
                        </div>
                        <div>
                            <label className={labelCls}>Prix mensuel (MAD)</label>
                            <input type="number" min="0" className={inputCls} value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} required />
                        </div>
                        <div>
                            <label className={labelCls}>Prix annuel (MAD)</label>
                            <input type="number" min="0" className={inputCls} value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} required />
                        </div>
                        <div>
                            <label className={labelCls}>Max. élèves (vide = illimité)</label>
                            <input type="number" min="1" className={inputCls} value={form.maxStudents} onChange={(e) => setForm({ ...form, maxStudents: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>Max. établissements (vide = illimité)</label>
                            <input type="number" min="1" className={inputCls} value={form.maxBranches} onChange={(e) => setForm({ ...form, maxBranches: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls}>Ordre d&apos;affichage</label>
                            <input type="number" className={inputCls} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-gray-700 mt-6">
                            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                            Pack actif
                        </label>
                    </div>

                    <fieldset>
                        <legend className={labelCls}>Types d&apos;établissement</legend>
                        <div className="flex flex-wrap gap-3">
                            {INSTITUTION_TYPES.map((type) => (
                                <label key={type} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={form.institutionTypes.includes(type)}
                                        onChange={() => setForm({ ...form, institutionTypes: toggle(form.institutionTypes, type) })}
                                    />
                                    {INSTITUTION_TYPE_LABELS[type]}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend className={labelCls}>Fonctionnalités incluses</legend>
                        <div className="flex flex-wrap gap-3">
                            {PACK_FEATURES.map((feature) => (
                                <label key={feature.key} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={form.features.includes(feature.key)}
                                        onChange={() => setForm({ ...form, features: toggle(form.features, feature.key) })}
                                    />
                                    {feature.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50">
                            Annuler
                        </button>
                        <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">
                            {saving ? 'Enregistrement…' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
