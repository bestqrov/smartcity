'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    TrendingUp,
    Users,
    BookOpen,
    DollarSign,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    GraduationCap
} from 'lucide-react';
import { getStudentAnalytics } from '@/lib/services/students';

export default function SoutienDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalInscriptions: 0,
        totalRevenue: 0,
        recentInscriptions: [] as any[]
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await getStudentAnalytics();
                setStats(data);
            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const StatCard = ({ title, value, icon: Icon, color, trend }: any) => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
                    <Icon className={color.replace('bg-', 'text-')} size={24} />
                </div>
                {trend && (
                    <span className={`flex items-center text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {trend > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    );

    if (loading) return <div className="p-8 text-center text-gray-500">Chargement des données...</div>;

    return (
        <div className="p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Etat de Soutien Scolaire</h1>
                    <p className="text-gray-500 mt-1">Vue d'ensemble de l'activité</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                        Exporter
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                        Nouveau Rapport
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="Total Étudiants"
                    value={stats.totalStudents}
                    icon={GraduationCap}
                    color="bg-blue-500"
                    trend={12}
                />
                <StatCard
                    title="Inscriptions Totales"
                    value={stats.totalInscriptions}
                    icon={Users}
                    color="bg-purple-500"
                    trend={8}
                />
                <StatCard
                    title="Total Profit"
                    value={`${Number(stats.totalRevenue).toFixed(2)} MAD`}
                    icon={DollarSign}
                    color="bg-green-500"
                    trend={24}
                />
            </div>

            {/* Recent Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Inscriptions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-800">Inscriptions Récentes</h3>
                        <button className="text-blue-600 text-sm font-medium hover:underline">Voir tout</button>
                    </div>
                    <div className="space-y-4">
                        {stats.recentInscriptions.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Aucune inscription récente</p>
                        ) : (
                            stats.recentInscriptions.map((inscription: any) => (
                                <div key={inscription.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                            {inscription.student?.name?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{inscription.student?.name}</p>
                                            <p className="text-sm text-gray-500">{new Date(inscription.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-800">{Number(inscription.amount).toFixed(2)} MAD</p>
                                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Payé</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Actions or Charts Placeholder */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
                    <h3 className="text-lg font-bold mb-4">Actions Rapides</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => router.push('/admin/inscriptions')}
                            className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left group"
                        >
                            <GraduationCap className="mb-3 text-blue-400 group-hover:scale-110 transition-transform" size={24} />
                            <p className="font-medium">Nouvel Étudiant</p>
                            <p className="text-sm text-gray-400 mt-1">Inscrire un élève</p>
                        </button>
                        <button
                            onClick={() => router.push('/admin/students')}
                            className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left group"
                        >
                            <Users className="mb-3 text-purple-400 group-hover:scale-110 transition-transform" size={24} />
                            <p className="font-medium">Liste Étudiants</p>
                            <p className="text-sm text-gray-400 mt-1">Voir tous les élèves</p>
                        </button>
                        <button
                            onClick={() => router.push('/admin/groups')}
                            className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left group"
                        >
                            <Calendar className="mb-3 text-orange-400 group-hover:scale-110 transition-transform" size={24} />
                            <p className="font-medium">Planning</p>
                            <p className="text-sm text-gray-400 mt-1">Gérer les cours</p>
                        </button>
                        <button
                            onClick={() => router.push('/admin/finance')}
                            className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left group"
                        >
                            <TrendingUp className="mb-3 text-green-400 group-hover:scale-110 transition-transform" size={24} />
                            <p className="font-medium">Rapports</p>
                            <p className="text-sm text-gray-400 mt-1">Voir les statistiques</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
