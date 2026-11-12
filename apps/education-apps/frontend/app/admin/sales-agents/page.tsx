'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, ChevronDown, ChevronRight, Plus, Wallet } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { Modal } from '@/components/ui/Modal';
import AgentRatesFields, { emptyRatesForm, ratesPayload, type RatesForm } from '@/components/admin/AgentRatesFields';
import { apiErrorMessage, getAllPacks, type AdminPack } from '@/lib/services/packs';
import { formatRates } from '@/lib/salesAgentLabels';
import { INSTITUTION_TYPE_LABELS, DEFAULT_INSTITUTION_TYPE } from '@/lib/institutionTypes';
import { AgentAvatar } from '@/components/agent/AgentAvatar';
import { ClientStatusBadge } from '@/components/agent/StatusBadge';
import {
    createSalesAgent,
    formatDay,
    formatLastPayment,
    formatMAD,
    getSalesAgentReport,
    getSalesAgents,
    type AgentReport,
    type SalesAgentListItem,
} from '@/lib/services/salesAgents';

const emptyForm = { name: '', email: '', password: '', phone: '', code: '' };

// Green when settled, orange while the company owes the agent, red when it paid more than earned.
const balanceClass = (balance: number): string =>
    balance === 0 ? 'text-green-700' : balance > 0 ? 'text-orange-600' : 'text-red-600';

export default function SalesAgentsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [agents, setAgents] = useState<SalesAgentListItem[]>([]);
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [rates, setRates] = useState<RatesForm>(emptyRatesForm);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [schoolsByAgent, setSchoolsByAgent] = useState<Record<string, AgentReport['schools']>>({});
    const [schoolsLoading, setSchoolsLoading] = useState<string | null>(null);
    const [schoolsError, setSchoolsError] = useState('');

    const toggleSchools = async (agentId: string) => {
        if (expandedId === agentId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(agentId);
        setSchoolsError('');
        if (schoolsByAgent[agentId]) return;
        setSchoolsLoading(agentId);
        try {
            const report = await getSalesAgentReport(agentId);
            setSchoolsByAgent((prev) => ({ ...prev, [agentId]: report.schools }));
        } catch (err) {
            setSchoolsError(apiErrorMessage(err));
        } finally {
            setSchoolsLoading((current) => (current === agentId ? null : current));
        }
    };

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [allAgents, allPacks] = await Promise.all([getSalesAgents(), getAllPacks()]);
            setAgents(allAgents);
            setPacks(allPacks);
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

    const openForm = () => {
        setForm(emptyForm);
        setRates(emptyRatesForm);
        setFormError('');
        setShowForm(true);
    };

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
                ...ratesPayload(rates),
            });
            setShowForm(false);
            await load();
        } catch (err) {
            setFormError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (!user || user.role !== 'SUPER_ADMIN') return null;

    const owed = agents.filter((agent) => agent.totals.balance > 0);
    const totalOwed = owed.reduce((total, agent) => total + agent.totals.balance, 0);
    const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Commerciaux</h1>
                    <p className="text-gray-600 mt-1">Codes, écoles apportées et commissions</p>
                </div>
                <button
                    onClick={openForm}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                >
                    <Plus size={18} /> Nouveau commercial
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>}

            {!loading && !error && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex items-center gap-4">
                    <Wallet className="text-orange-600 shrink-0" size={28} />
                    <div>
                        <div className="text-sm text-orange-800">Total dû aux commerciaux</div>
                        <div className="text-2xl font-bold text-orange-700">{formatMAD(totalOwed)}</div>
                        <div className="text-xs text-orange-800">
                            {owed.length === 0
                                ? 'Aucun commercial à payer'
                                : `${owed.length} commercia${owed.length > 1 ? 'ux' : 'l'} avec un solde à payer`}
                        </div>
                    </div>
                </div>
            )}

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
                                <th className="px-3 py-3 sm:px-6 sm:py-4">Commercial</th>
                                <th className="px-3 py-3 sm:px-6 sm:py-4">Code</th>
                                <th className="px-3 py-3 sm:px-6 sm:py-4">Taux</th>
                                <th className="px-3 py-3 sm:px-6 sm:py-4">Écoles</th>
                                <th className="px-3 py-3 sm:px-6 sm:py-4">Commissions</th>
                                <th className="px-3 py-3 sm:px-6 sm:py-4">Versé</th>
                                <th className="px-3 py-3 sm:px-6 sm:py-4">Reste à payer</th>
                                <th className="px-3 py-3 sm:px-6 sm:py-4">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((agent) => (
                                <Fragment key={agent.id}>
                                <tr className="border-t border-gray-100 hover:bg-gray-50">
                                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                                        <div className="flex items-center gap-2">
                                            <AgentAvatar src={agent.avatar} name={agent.name} size={28} className="bg-indigo-100 text-indigo-700" />
                                            <div className="min-w-0">
                                                <Link href={`/admin/sales-agents/${agent.id}`} className="font-semibold text-indigo-700 hover:underline">
                                                    {agent.name}
                                                </Link>
                                                {agent.isHouse && (
                                                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">Société</span>
                                                )}
                                                <div className="text-xs text-gray-500">{agent.email ?? '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 sm:px-6 sm:py-4 font-mono font-bold">{agent.code}</td>
                                    <td className="px-3 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                        {formatRates(agent)}
                                        {agent.packRates.length > 0 && (
                                            <div className="text-xs text-indigo-700">
                                                +{agent.packRates.length} exception{agent.packRates.length > 1 ? 's' : ''}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                                        <button
                                            type="button"
                                            onClick={() => toggleSchools(agent.id)}
                                            aria-expanded={expandedId === agent.id}
                                            aria-label={`Voir les écoles de ${agent.name}`}
                                            className="flex items-center gap-1 text-left font-semibold text-indigo-700 hover:underline"
                                        >
                                            {expandedId === agent.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            {agent.totals.activeSchools} / {agent.totals.schools}
                                        </button>
                                        <div className="text-xs text-gray-500">actives / total</div>
                                    </td>
                                    <td className="px-3 py-3 sm:px-6 sm:py-4">{formatMAD(agent.totals.totalCommissions)}</td>
                                    <td className="px-3 py-3 sm:px-6 sm:py-4">{formatMAD(agent.totals.totalPayouts)}</td>
                                    <td className={`px-6 py-4 font-bold whitespace-nowrap ${balanceClass(agent.totals.balance)}`}>
                                        {formatMAD(agent.totals.balance)}
                                    </td>
                                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                agent.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                            }`}
                                        >
                                            {agent.active ? 'Actif' : 'Inactif'}
                                        </span>
                                    </td>
                                </tr>
                                {expandedId === agent.id && (
                                    <tr className="bg-gray-50 border-t border-gray-100">
                                        <td colSpan={8} className="px-3 py-3 sm:px-6 sm:py-4">
                                            {schoolsLoading === agent.id ? (
                                                <p className="text-sm text-gray-500">Chargement…</p>
                                            ) : schoolsError && !schoolsByAgent[agent.id] ? (
                                                <p className="text-sm text-red-600">{schoolsError}</p>
                                            ) : schoolsByAgent[agent.id]?.length === 0 ? (
                                                <p className="text-sm text-gray-500">Aucune école pour ce commercial.</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                                                                <tr>
                                                                    <th className="px-3 py-2">École</th>
                                                                    <th className="px-3 py-2">Statut</th>
                                                                    <th className="px-3 py-2">Type / Pack</th>
                                                                    <th className="px-3 py-2">Date d&apos;achat</th>
                                                                    <th className="px-3 py-2">Dernier paiement</th>
                                                                    <th className="px-3 py-2">Total payé</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {schoolsByAgent[agent.id]?.map((school) => (
                                                                    <tr key={school.id} className="border-t border-gray-100">
                                                                        <td className="px-3 py-2 font-semibold">
                                                                            {school.name}
                                                                            <div className="text-xs font-normal text-gray-500">{school.city || '—'}</div>
                                                                        </td>
                                                                        <td className="px-3 py-2"><ClientStatusBadge status={school.clientStatus} /></td>
                                                                        <td className="px-3 py-2">
                                                                            {INSTITUTION_TYPE_LABELS[school.institutionType ?? DEFAULT_INSTITUTION_TYPE]}
                                                                            <div className="text-xs text-gray-500">{school.packName ?? 'Aucun pack'}</div>
                                                                        </td>
                                                                        <td className="px-3 py-2 whitespace-nowrap">{school.firstPaidAt ? formatDay(school.firstPaidAt) : '—'}</td>
                                                                        <td className="px-3 py-2 whitespace-nowrap">{formatLastPayment(school)}</td>
                                                                        <td className="px-3 py-2 whitespace-nowrap">{formatMAD(school.totalPaid)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <Link href={`/admin/sales-agents/${agent.id}`} className="text-sm font-semibold text-indigo-700 hover:underline">
                                                        Voir le détail →
                                                    </Link>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nouveau commercial" size="lg">
                <form onSubmit={submit} className="space-y-3">
                    {formError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{formError}</div>}
                    <input className={inputClass} aria-label="Nom complet" placeholder="Nom complet" value={form.name} onChange={set('name')} required />
                    <input className={inputClass} type="email" aria-label="Email (identifiant)" placeholder="Email (identifiant)" value={form.email} onChange={set('email')} required />
                    <input className={inputClass} type="password" aria-label="Mot de passe" placeholder="Mot de passe (8 caractères min.)" minLength={8} value={form.password} onChange={set('password')} required />
                    <input className={inputClass} aria-label="Téléphone" placeholder="Téléphone" value={form.phone} onChange={set('phone')} />
                    <input className={`${inputClass} font-mono`} aria-label="Code commercial" placeholder="Code (ex. YOUSSEF22)" pattern="[A-Z0-9\-]{3,20}" value={form.code} onChange={set('code')} required />
                    <div className="pt-2 border-t border-gray-100">
                        <div className="text-sm font-semibold text-gray-700 mb-2">Taux de commission</div>
                        <AgentRatesFields value={rates} onChange={setRates} packs={packs} />
                    </div>
                    <button disabled={saving} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50">
                        {saving ? 'Création…' : 'Créer'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}
