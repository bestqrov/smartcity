'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/useAuthStore';
import { getAllSchools, updateSchoolStatus, SchoolListItem } from '@/lib/services/schools';
import { Building2, CheckCircle } from 'lucide-react';

export default function SuperAdminSchoolsPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [schools, setSchools] = useState<SchoolListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activatingId, setActivatingId] = useState<string | null>(null);

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
            const data = await getAllSchools();
            setSchools(data);
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

    if (!user || user.role !== 'SUPER_ADMIN') {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Écoles</h1>
                    <p className="text-gray-600 mt-1">Gérer l'activation des écoles sur la plateforme</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                    <Building2 className="text-blue-600" size={32} />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">{error}</div>
            )}

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-x-auto">
                {loading ? (
                    <p className="p-8 text-gray-500">Chargement…</p>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-sm uppercase">
                            <tr>
                                <th className="px-6 py-4">École</th>
                                <th className="px-6 py-4">Email propriétaire</th>
                                <th className="px-6 py-4">Statut</th>
                                <th className="px-6 py-4">Fin essai</th>
                                <th className="px-6 py-4">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schools.map((school) => (
                                <tr key={school.id} className="border-t border-gray-100">
                                    <td className="px-6 py-4 font-semibold text-gray-800">{school.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{school.ownerEmail}</td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                school.status === 'ACTIVE'
                                                    ? 'bg-green-100 text-green-700'
                                                    : school.status === 'SUSPENDED'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}
                                        >
                                            {school.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {school.trialEndsAt ? new Date(school.trialEndsAt).toLocaleDateString('fr-FR') : '—'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {school.status === 'PENDING' && (
                                            <button
                                                onClick={() => handleActivate(school.id)}
                                                disabled={activatingId === school.id}
                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50"
                                            >
                                                <CheckCircle size={16} />
                                                {activatingId === school.id ? 'Activation…' : 'Activer'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
