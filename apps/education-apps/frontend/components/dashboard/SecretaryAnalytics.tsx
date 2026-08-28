'use client';

import { useEffect, useState } from 'react';
import { getInscriptionAnalytics, InscriptionAnalytics } from '@/lib/services/inscriptions';
import { TrendingUp, Users, Calendar, DollarSign, BookOpen, GraduationCap } from 'lucide-react';

export default function SecretaryAnalytics() {
    const [analytics, setAnalytics] = useState<InscriptionAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const data = await getInscriptionAnalytics();
                setAnalytics(data);
            } catch (err: any) {
                console.error('Error fetching analytics:', err);
                setError('Impossible de charger les statistiques');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
            </div>
        );
    }

    if (!analytics) return null;

    const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
        <div className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${color}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                </div>
                <div className={`p-3 rounded-full ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
                    <Icon className={color.replace('border-', 'text-')} size={24} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Daily Analytics */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="text-blue-600" size={24} />
                    <h2 className="text-2xl font-bold text-gray-800">Statistiques du Jour</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Inscriptions Totales"
                        value={analytics.daily.count}
                        icon={Users}
                        color="border-blue-500"
                    />
                    <StatCard
                        title="Montant Total"
                        value={`${analytics.daily.total.toFixed(2)} DH`}
                        icon={DollarSign}
                        color="border-green-500"
                    />
                    <StatCard
                        title="Soutien Scolaire"
                        value={analytics.daily.soutien}
                        subtitle="inscriptions"
                        icon={BookOpen}
                        color="border-purple-500"
                    />
                    <StatCard
                        title="Formation Pro"
                        value={analytics.daily.formation}
                        subtitle="inscriptions"
                        icon={GraduationCap}
                        color="border-orange-500"
                    />
                </div>
            </div>

            {/* Monthly Analytics */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="text-green-600" size={24} />
                    <h2 className="text-2xl font-bold text-gray-800">Statistiques du Mois</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="Inscriptions Totales"
                        value={analytics.monthly.count}
                        icon={Users}
                        color="border-blue-500"
                    />
                    <StatCard
                        title="Montant Total"
                        value={`${analytics.monthly.total.toFixed(2)} DH`}
                        icon={DollarSign}
                        color="border-green-500"
                    />
                    <StatCard
                        title="Soutien Scolaire"
                        value={analytics.monthly.soutien}
                        subtitle="inscriptions"
                        icon={BookOpen}
                        color="border-purple-500"
                    />
                    <StatCard
                        title="Formation Pro"
                        value={analytics.monthly.formation}
                        subtitle="inscriptions"
                        icon={GraduationCap}
                        color="border-orange-500"
                    />
                </div>
            </div>
        </div>
    );
}
