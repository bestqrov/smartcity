'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/useAuthStore';
import { getAllSchools, updateSchoolStatus, SchoolListItem } from '@/lib/services/schools';
import { Building2, CheckCircle, Pencil, Wallet } from 'lucide-react';
import EditSchoolModal from '@/components/admin/EditSchoolModal';
import PhoneContact from '@/components/common/PhoneContact';
import SchoolPaymentsModal from '@/components/admin/SchoolPaymentsModal';
import { assignSchoolAgent, getSalesAgents, type SalesAgentListItem, type SubscriptionPeriod } from '@/lib/services/salesAgents';
import { INSTITUTION_TYPE_LABELS, DEFAULT_INSTITUTION_TYPE } from '@/lib/institutionTypes';
import { formatOfferMoney } from '@/lib/services/partnerOffer';
import { apiErrorMessage, assignSchoolPack, getAllPacks, type AdminPack } from '@/lib/services/packs';

import { appLocale } from '@/lib/i18n/I18nProvider';
const OFFER_BADGE_LABELS = { MONTHLY: 'Mensuel', SEMIANNUAL: '6 mois', YEARLY: 'Annuel' } as const;

export default function SuperAdminSchoolsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [schools, setSchools] = useState<SchoolListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activatingId, setActivatingId] = useState<string | null>(null);
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [agents, setAgents] = useState<SalesAgentListItem[]>([]);
    const [editSchool, setEditSchool] = useState<SchoolListItem | null>(null);
    const [paymentsSchool, setPaymentsSchool] = useState<{ id: string; name: string; offerPeriod: SubscriptionPeriod | null; offerPrice: number | null } | null>(null);

    useEffect(() => {
        if (user && user.role !== 'SUPER_ADMIN') {
            router.push('/admin');
            return;
        }
        if (user?.role === 'SUPER_ADMIN') {
            fetchSchools();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, router]);

    const fetchSchools = async () => {
        setLoading(true);
        setError('');
        try {
            const [data, allPacks, allAgents] = await Promise.all([getAllSchools(), getAllPacks(), getSalesAgents()]);
            setSchools(data);
            setPacks(allPacks);
            setAgents(allAgents);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Échec du chargement des écoles');
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async (id: string) => {
        setActivatingId(id);
        try {
            await updateSchoolStatus(id, 'ACTIVE');
            await fetchSchools();
        } catch (err: any) {
            setError(err.response?.data?.message || "Échec de l'activation");
        } finally {
            setActivatingId(null);
        }
    };

    const handleAssignPack = async (schoolId: string, packId: string) => {
        if (!packId) return;
        setAssigningId(schoolId);
        setError('');
        try {
            await assignSchoolPack(schoolId, packId);
            await fetchSchools();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setAssigningId(null);
        }
    };

    const handleAssignAgent = async (schoolId: string, agentId: string) => {
        setAssigningId(schoolId);
        setError('');
        try {
            await assignSchoolAgent(schoolId, agentId || null);
            await fetchSchools();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setAssigningId(null);
        }
    };

    if (!user || user.role !== 'SUPER_ADMIN') {
        return null;
    }

    const statusBadge = (status: string) => (
        <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
                status === 'ACTIVE' ? 'bg-green-100 text-green-700' : status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}
        >
            {status}
        </span>
    );
    const partnerBadge = (school: SchoolListItem) =>
        school.offerPeriod ? (
            <span
                className={`ms-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    school.partnerOffer ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
            >
                {school.partnerOffer ? 'Partenaire · ' : ''}
                {OFFER_BADGE_LABELS[school.offerPeriod]}
                {school.offerPrice != null && ` · ${formatOfferMoney(school.offerPrice)} MAD`}
            </span>
        ) : null;
    const packSelect = (school: SchoolListItem, className: string) => (
        <select
            value={school.packId ?? ''}
            disabled={assigningId === school.id}
            onChange={(e) => handleAssignPack(school.id, e.target.value)}
            className={`${className} border border-gray-200 rounded-lg text-sm disabled:opacity-50`}
        >
            <option value="">Aucun pack</option>
            {packs
                .filter((pack) => (pack.active && pack.institutionTypes.includes(school.institutionType ?? DEFAULT_INSTITUTION_TYPE)) || pack.id === school.packId)
                .map((pack) => (
                    <option key={pack.id} value={pack.id}>
                        {pack.active ? pack.name : `${pack.name} (inactif)`}
                    </option>
                ))}
        </select>
    );
    const agentSelect = (school: SchoolListItem, className: string) => (
        <select
            value={school.salesAgentId ?? ''}
            disabled={assigningId === school.id}
            onChange={(e) => handleAssignAgent(school.id, e.target.value)}
            className={`${className} border border-gray-200 rounded-lg text-sm disabled:opacity-50`}
        >
            <option value="">Aucun commercial</option>
            {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.code}){agent.active ? '' : ' — inactif'}
                </option>
            ))}
        </select>
    );
    const actionButtons = (school: SchoolListItem, btn: string) => (
        <>
            {school.status === 'PENDING' && (
                <button
                    onClick={() => handleActivate(school.id)}
                    disabled={activatingId === school.id}
                    className={`${btn} bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50`}
                >
                    <CheckCircle size={16} />
                    {activatingId === school.id ? 'Activation…' : 'Activer'}
                </button>
            )}
            <button onClick={() => setEditSchool(school)} className={`${btn} bg-gray-100 hover:bg-gray-200 text-gray-800`}>
                <Pencil size={16} /> Modifier
            </button>
            <button
                onClick={() => setPaymentsSchool({ id: school.id, name: school.name, offerPeriod: school.offerPeriod ?? null, offerPrice: school.offerPrice ?? null })}
                className={`${btn} bg-gray-100 hover:bg-gray-200 text-gray-800`}
            >
                <Wallet size={16} /> Paiements
            </button>
        </>
    );
    const typeLabel = (school: SchoolListItem) => INSTITUTION_TYPE_LABELS[school.institutionType ?? DEFAULT_INSTITUTION_TYPE];
    // Signup date and time, in the browser's time zone (e.g. "22/11/2026 14:35").
    const signupLabel = (school: SchoolListItem) =>
        new Date(school.createdAt).toLocaleString(appLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const trialLabel = (school: SchoolListItem) => (school.trialEndsAt ? new Date(school.trialEndsAt).toLocaleDateString(appLocale()) : '—');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white sm:text-3xl">Écoles</h1>
                    <p className="text-gray-600 mt-1">Gérer l'activation des écoles sur la plateforme</p>
                </div>
                <div className="shrink-0 rounded-lg bg-blue-100 p-2.5 sm:p-3">
                    <Building2 className="text-blue-600" size={32} />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-x-auto">
                {loading ? (
                    <p className="p-6 text-gray-500 sm:p-8">Chargement…</p>
                ) : (
                    <>
                    <ul className="divide-y divide-gray-100 md:hidden">
                        {schools.map((school) => (
                            <li key={school.id} className="space-y-3 p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-gray-800">{school.name}</div>
                                        <div className="break-all text-sm text-gray-600">{school.ownerEmail}</div>
                                        <PhoneContact phone={school.ownerPhone} className="text-sm text-gray-600" />
                                    </div>
                                    {statusBadge(school.status)}
                                </div>
                                {partnerBadge(school) && <div>{partnerBadge(school)}</div>}
                                <div className="text-sm text-gray-600">
                                    {typeLabel(school)} · Fin essai : {trialLabel(school)}
                                </div>
                                <div className="text-sm text-gray-600">
                                    Inscrite le <span className="tabular-nums">{signupLabel(school)}</span>
                                </div>
                                {packSelect(school, 'w-full min-h-10 px-3 py-2')}
                                {agentSelect(school, 'w-full min-h-10 px-3 py-2')}
                                <div className="flex flex-wrap gap-2">{actionButtons(school, 'flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold')}</div>
                            </li>
                        ))}
                    </ul>
                    <table className="hidden w-full text-start md:table">
                        <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                            <tr>
                                <th className="px-4 py-3">École</th>
                                <th className="px-4 py-3">Contact propriétaire</th>
                                <th className="px-4 py-3">Inscrite le</th>
                                <th className="px-4 py-3">Statut</th>
                                <th className="px-4 py-3">Fin essai</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Pack</th>
                                <th className="px-4 py-3">Commercial</th>
                                <th className="px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schools.map((school) => (
                                <tr key={school.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3 font-semibold text-gray-800">
                                        {school.name}
                                        {partnerBadge(school)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">
                                        <div className="break-all">{school.ownerEmail}</div>
                                        <PhoneContact phone={school.ownerPhone} className="text-sm" />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-gray-600">{signupLabel(school)}</td>
                                    <td className="px-4 py-3">{statusBadge(school.status)}</td>
                                    <td className="px-4 py-3 text-gray-600">{trialLabel(school)}</td>
                                    <td className="px-4 py-3 text-gray-600">{typeLabel(school)}</td>
                                    <td className="px-4 py-3">{packSelect(school, 'px-3 py-1.5')}</td>
                                    <td className="px-4 py-3">{agentSelect(school, 'px-3 py-1.5')}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">{actionButtons(school, 'flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm')}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </>
                )}
            </div>
            {editSchool && <EditSchoolModal key={editSchool.id} school={editSchool} onClose={() => setEditSchool(null)} onSaved={fetchSchools} />}
            {paymentsSchool && <SchoolPaymentsModal key={paymentsSchool.id} school={paymentsSchool} onClose={() => setPaymentsSchool(null)} />}
        </div>
    );
}
