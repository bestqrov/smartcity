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
    GraduationCap,
    Clock,
    Save
} from 'lucide-react';
import { formationsService } from '@/lib/services/formations';
import Button from '@/components/Button';
import FormationInscriptionForm from '@/components/forms/FormationInscriptionForm';

export default function FormationDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalFormations: 0,
        totalInscriptions: 0,
        totalRevenue: 0,
        recentInscriptions: [] as any[]
    });
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        duration: '',
        price: '',
        description: '',
    });

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setCreateLoading(true);
            await formationsService.create({
                name: formData.name,
                duration: formData.duration,
                price: parseFloat(formData.price),
                description: formData.description || undefined,
            });

            alert('Formation créée avec succès !');
            setIsModalOpen(false);
            setFormData({ name: '', duration: '', price: '', description: '' });
            // Refresh stats
            const data = await formationsService.getAnalytics();
            setStats(data);
        } catch (error: any) {
            console.error('Formation creation failed:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la création';
            alert(`Erreur: ${errorMessage}`);
        } finally {
            setCreateLoading(false);
        }
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await formationsService.getAnalytics();
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

            {/* Dashboard View */}
            {!isModalOpen && !isInscriptionModalOpen && (
                <>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Tableau de Bord Formations</h1>
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
                            title="Total Formations"
                            value={stats.totalFormations}
                            icon={BookOpen}
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
                            title="Revenu Total"
                            value={`${stats.totalRevenue} DH`}
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
                                                <p className="font-bold text-gray-800">{inscription.amount} DH</p>
                                                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Payé</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6 text-white">
                            <h3 className="text-lg font-bold mb-4">Actions Rapides</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left group"
                                >
                                    <BookOpen className="mb-3 text-blue-400 group-hover:scale-110 transition-transform" size={24} />
                                    <p className="font-medium">Nouvelle Formation</p>
                                    <p className="text-sm text-gray-400 mt-1">Créer un nouveau cours</p>
                                </button>
                                <button
                                    onClick={() => setIsInscriptionModalOpen(true)}
                                    className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left group"
                                >
                                    <Users className="mb-3 text-purple-400 group-hover:scale-110 transition-transform" size={24} />
                                    <p className="font-medium">Inscrire un élève</p>
                                    <p className="text-sm text-gray-400 mt-1">Ajouter une inscription</p>
                                </button>
                                <button
                                    onClick={() => router.push('/admin/teachers?type=FORMATION')}
                                    className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left group"
                                >
                                    <TrendingUp className="mb-3 text-pink-400 group-hover:scale-110 transition-transform" size={24} />
                                    <p className="font-medium">Nouveau Professeur</p>
                                    <p className="text-sm text-gray-400 mt-1">Ajouter un formateur</p>
                                </button>
                                <button
                                    onClick={() => router.push('/admin/groups?type=FORMATION')}
                                    className="p-4 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-left group"
                                >
                                    <Calendar className="mb-3 text-orange-400 group-hover:scale-110 transition-transform" size={24} />
                                    <p className="font-medium">Planning</p>
                                    <p className="text-sm text-gray-400 mt-1">Gérer les horaires</p>
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
                </>
            )}

            {/* New Formation View */}
            {isModalOpen && (
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-purple-500 p-8 text-white">
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/10 rounded-full blur-3xl"></div>

                        <div className="relative z-10 flex justify-between items-center">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight">Nouvelle Formation</h2>
                                <p className="text-purple-100 font-medium mt-1">Créer une nouvelle formation professionnelle</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleCreateSubmit} className="p-8 space-y-6 bg-gray-50/50">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nom de la formation <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleFormChange}
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                                        placeholder="Ex: Coiffure Professionnelle"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Durée <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                name="duration"
                                                value={formData.duration}
                                                onChange={handleFormChange}
                                                required
                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                                                placeholder="Ex: 3 mois"
                                            />
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Prix (DH) <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                name="price"
                                                value={formData.price}
                                                onChange={handleFormChange}
                                                required
                                                min="0"
                                                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                                                placeholder="Ex: 2500"
                                            />
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                                    <textarea
                                        name="description"
                                        value={formData.description}
                                        onChange={handleFormChange}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none resize-none"
                                        placeholder="Description du programme..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" onClick={() => setIsModalOpen(false)} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-6 py-3 rounded-xl">Annuler</Button>
                            <Button type="submit" disabled={createLoading} className="bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/20 px-8 py-3 rounded-xl">
                                {createLoading ? 'Création...' : 'Créer la Formation'}
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {/* Inscription View */}
            {isInscriptionModalOpen && (
                <FormationInscriptionForm
                    onCancel={() => setIsInscriptionModalOpen(false)}
                    onSuccess={() => {
                        alert('Inscription réussie !');
                        setIsInscriptionModalOpen(false);
                        // Refresh stats
                        formationsService.getAnalytics().then(setStats);
                    }}
                />
            )}
        </div>
    );
}
