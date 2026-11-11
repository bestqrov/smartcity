'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, Plus } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import { apiErrorMessage } from '@/lib/services/packs';
import { createSalesAgent, formatMAD, getSalesAgents, type SalesAgentListItem } from '@/lib/services/salesAgents';

const emptyForm = { name: '', email: '', password: '', phone: '', code: '', commissionRate: '10' };

export default function SalesAgentsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [agents, setAgents] = useState<SalesAgentListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setAgents(await getSalesAgents());
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') router.push('/admin');
        else if (user) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router]);

    const set = (field: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [field]: field === 'code' ? e.target.value.toUpperCase() : e.target.value }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFormError('');
        try {
            await createSalesAgent({
                name: form.name,
                email: form.email,
                password: form.password,
                phone: form.phone || undefined,
                code: form.code,
                commissionRate: Number(form.commissionRate),
            });
            setShowForm(false);
            setForm(emptyForm);
            await load();
        } catch (err) {
            setFormError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (!user || user.role !== 'SUPER_ADMIN') return null;

    const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Commerciaux</h1>
                    <p className="text-gray-600 mt-1">Codes, écoles apportées et commissions</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                >
                    <Plus size={18} /> Nouveau commercial
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>}

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-x-auto">
                {loading ? (
                    <p className="p-8 text-gray-500">Chargement…</p>
                ) : agents.length === 0 ? (
                    <div className="p-8 text-gray-500 flex items-center gap-3">
                        <Briefcase size={20} /> Aucun commercial. Lancez le seed du code société (ARWA) puis ajoutez vos commerciaux.
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4">Commercial</th>
                                <th className="px-6 py-4">Code</th>
                                <th className="px-6 py-4">Taux</th>
                                <th className="px-6 py-4">Écoles</th>
                                <th className="px-6 py-4">Commissions</th>
                                <th className="px-6 py-4">Versé</th>
                                <th className="px-6 py-4">Solde</th>
                                <th className="px-6 py-4">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((agent) => (
                                <tr key={agent.id} className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <Link href={`/admin/sales-agents/${agent.id}`} className="font-semibold text-indigo-700 hover:underline">
                                            {agent.name}
                                        </Link>
                                        {agent.isHouse && (
                                            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">Société</span>
                                        )}
                                        <div className="text-xs text-gray-500">{agent.email ?? '—'}</div>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-bold">{agent.code}</td>
                                    <td className="px-6 py-4">{agent.commissionRate} %</td>
                                    <td className="px-6 py-4">
                                        {agent.totals.activeSchools} / {agent.totals.schools}
                                        <div className="text-xs text-gray-500">actives / total</div>
                                    </td>
                                    <td className="px-6 py-4">{formatMAD(agent.totals.totalCommissions)}</td>
                                    <td className="px-6 py-4">{formatMAD(agent.totals.totalPayouts)}</td>
                                    <td className="px-6 py-4 font-bold">{formatMAD(agent.totals.balance)}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                agent.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {agent.active ? 'Actif' : 'Inactif'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nouveau commercial">
                <form onSubmit={submit} className="space-y-3">
                    {formError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{formError}</div>}
                    <input className={inputClass} placeholder="Nom complet" value={form.name} onChange={set('name')} required />
                    <input className={inputClass} type="email" placeholder="Email (identifiant)" value={form.email} onChange={set('email')} required />
                    <input className={inputClass} type="password" placeholder="Mot de passe (8 caractères min.)" minLength={8} value={form.password} onChange={set('password')} required />
                    <input className={inputClass} placeholder="Téléphone" value={form.phone} onChange={set('phone')} />
                    <input className={`${inputClass} font-mono`} placeholder="Code (ex. YOUSSEF22)" pattern="[A-Z0-9\-]{3,20}" value={form.code} onChange={set('code')} required />
                    <label className="block text-sm text-gray-600">
                        Taux de commission (%)
                        <input className={inputClass} type="number" min={0} max={100} step="0.5" value={form.commissionRate} onChange={set('commissionRate')} required />
                    </label>
                    <button disabled={saving} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50">
                        {saving ? 'Création…' : 'Créer'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
