'use client';

import {
    Users,
    Briefcase,
    TrendingUp,
    DollarSign,
    Building,
    Eye,
    ArrowUpRight,
    ArrowDownRight,
    Plus,
    RefreshCw,
    Wallet
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStudents, getStudentAnalytics } from '@/lib/services/students';
import { formationsService } from '@/lib/services/formations';
import { getPaymentAnalytics } from '@/lib/services/payments';
import Calendar from '@/components/Calendar';
import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';

export default function AdminDashboard() {
    const router = useRouter();
    const { profile, loading: profileLoading, refreshProfile } = useSchoolProfile();
    const [stats, setStats] = useState({
        totalStudents: 0,
        studentsThisMonth: 0,
        totalEmployees: 0,
        revenueThisMonth: 0, // CA Theoretical
        totalReceivedMonth: 0, // Actual Cash In
        expenses: 0, // Total Expenses
        netCash: 0, // Net de Mois
        unpaid: 0,
    });

    const [loading, setLoading] = useState(true);
    const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);

    useEffect(() => {
        loadDashboardData(true);

        // Auto-refresh every 30 seconds
        const refreshInterval = setInterval(() => loadDashboardData(false), 30000);

        const handleVisibilityChange = () => !document.hidden && loadDashboardData(false);
        const handleFocus = () => loadDashboardData(false);
        const handleDashboardRefresh = () => loadDashboardData(false);

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('dashboardRefresh', handleDashboardRefresh);

        return () => {
            clearInterval(refreshInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('dashboardRefresh', handleDashboardRefresh);
        };
    }, []);

    const loadDashboardData = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // --- 1. Students ---
            let totalStudents = 0;
            let studentsThisMonth = 0;
            try {
                const students = await getStudents();
                totalStudents = students.length;
                studentsThisMonth = students.filter((student: any) => {
                    if (student.createdAt) {
                        const createdDate = new Date(student.createdAt);
                        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
                    }
                    return false;
                }).length;
            } catch (error) {
                console.error('Failed to load students', error);
            }

            // --- 2. Employees (Professors + Secretaries) ---
            let totalEmployees = 0;
            try {
                const storedProfessors = JSON.parse(localStorage.getItem('professors') || '[]');
                const storedSecretaries = JSON.parse(localStorage.getItem('secretaires') || '[]');
                const storedUsers = JSON.parse(localStorage.getItem('users') || '[]');

                const secretaryCount = storedSecretaries.length > 0
                    ? storedSecretaries.length
                    : storedUsers.filter((u: any) => u.role === 'SECRETARY').length || 1;

                totalEmployees = storedProfessors.length + secretaryCount;
            } catch (error) {
                console.error('Failed to load employees', error);
            }

            // --- 3. Financials ---
            try {
                const [studentAnalytics, formationAnalytics, paymentAnalytics] = await Promise.all([
                    getStudentAnalytics(),
                    formationsService.getAnalytics(),
                    getPaymentAnalytics()
                ]);

                // Revenue (CA)
                const totalRevenue = (studentAnalytics.totalRevenue || 0) + (formationAnalytics.monthlyRevenue || 0);

                // Cash Flow
                const totalReceived = paymentAnalytics.totalReceivedMonth || 0;
                const totalExpenses = (paymentAnalytics as any).totalExpenses || 0;
                const netCash = totalReceived - totalExpenses;
                const unpaid = Math.max(0, totalRevenue - totalReceived);

                setStats(prev => ({
                    ...prev,
                    totalStudents,
                    studentsThisMonth,
                    totalEmployees,
                    revenueThisMonth: totalRevenue,
                    totalReceivedMonth: totalReceived,
                    expenses: totalExpenses,
                    netCash,
                    unpaid
                }));

            } catch (error) {
                console.error('Failed to load financial data', error);
            }

        } catch (error) {
            console.error('Dashboard data load failed', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    if (loading || profileLoading) return (
        <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium">Chargement du tableau de bord...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Top Bar: Welcome & Actions */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-4">
                    {profile.logo ? (
                        <img src={profile.logo} alt="Logo" className="w-14 h-14 rounded-xl object-contain bg-white shadow-sm border border-gray-100" />
                    ) : (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Building size={24} />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{profile.schoolName}</h1>
                        <p className="text-gray-500 flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            En ligne &bull; {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <button
                        onClick={() => { loadDashboardData(false); refreshProfile(); }}
                        className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-95"
                        title="Actualiser"
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={() => setIsInscriptionModalOpen(true)}
                        className="flex-1 lg:flex-none px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium shadow-lg shadow-gray-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                    >
                        <Plus size={18} />
                        Nouvelle Inscription
                    </button>
                </div>
            </div>

            {/* HERO SECTION: NET DE MOIS */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl shadow-gray-900/20">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl"></div>

                <div className="relative p-8 lg:p-10">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
                        <div>
                            <div className="flex items-center gap-3 mb-2 text-gray-400">
                                <Wallet size={24} />
                                <span className="font-medium tracking-wide uppercase text-sm">Net du Mois (Cash Flow)</span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <h2 className={`text-5xl lg:text-6xl font-bold tracking-tight ${stats.netCash >= 0 ? 'text-white' : 'text-red-400'}`}>
                                    {stats.netCash.toLocaleString('fr-MA', { minimumFractionDigits: 2 })}
                                </h2>
                                <span className="text-xl text-gray-400 font-medium">MAD</span>
                            </div>
                            <p className="mt-4 text-gray-300 max-w-md text-sm leading-relaxed">
                                Le montant réel disponible dans la caisse après déduction de toutes les dépenses du mois courant.
                            </p>
                        </div>

                        {/* Mini Stats Breakdown */}
                        <div className="flex gap-8 bg-white/5 rounded-2xl p-6 backdrop-blur-sm border border-white/10 w-full lg:w-auto">
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Encaissements</p>
                                <p className="text-xl font-bold text-emerald-400 flex items-center gap-1">
                                    <ArrowUpRight size={16} />
                                    {stats.totalReceivedMonth.toLocaleString()} <span className="text-xs opacity-70">MAD</span>
                                </p>
                            </div>
                            <div className="w-px bg-white/10"></div>
                            <div>
                                <p className="text-xs text-gray-400 mb-1">Dépenses</p>
                                <p className="text-xl font-bold text-red-400 flex items-center gap-1">
                                    <ArrowDownRight size={16} />
                                    {stats.expenses.toLocaleString()} <span className="text-xs opacity-70">MAD</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN: Financial Health Details */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-600" />
                        Performance Financière
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CA Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                                    <TrendingUp size={24} />
                                </div>
                                <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Objectif</span>
                            </div>
                            <h4 className="text-gray-500 text-sm font-medium">Chiffre d'Affaires</h4>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {stats.revenueThisMonth.toLocaleString()} <span className="text-sm font-normal text-gray-500">MAD</span>
                            </p>
                            <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                                <span className="text-gray-500">Valeur théorique totale</span>
                                <span className="text-orange-500 font-medium">{stats.unpaid.toLocaleString()} MAD impayés</span>
                            </div>
                        </div>

                        {/* Expenses Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => router.push('/admin/finance/transactions')}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                                    <ArrowDownRight size={24} />
                                </div>
                                <div className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                                    <Eye size={16} className="text-gray-400 group-hover:text-gray-600" />
                                </div>
                            </div>
                            <h4 className="text-gray-500 text-sm font-medium">Dépenses Totales</h4>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {stats.expenses.toLocaleString()} <span className="text-sm font-normal text-gray-500">MAD</span>
                            </p>
                            <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-500">
                                Inclut salaires et charges
                            </div>
                        </div>
                    </div>

                    {/* Quick Access Grid */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h4 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Accès Rapide</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <button onClick={() => router.push('/admin/students')} className="p-4 rounded-xl bg-gray-50 hover:bg-blue-50 hover:text-blue-600 transition-colors text-center group">
                                <Users className="mx-auto mb-2 text-gray-400 group-hover:text-blue-500" size={24} />
                                <span className="text-sm font-medium">Étudiants</span>
                            </button>
                            <button onClick={() => router.push('/admin/teachers')} className="p-4 rounded-xl bg-gray-50 hover:bg-purple-50 hover:text-purple-600 transition-colors text-center group">
                                <Briefcase className="mx-auto mb-2 text-gray-400 group-hover:text-purple-500" size={24} />
                                <span className="text-sm font-medium">Profs</span>
                            </button>
                            <button onClick={() => router.push('/admin/finance/paiements')} className="p-4 rounded-xl bg-gray-50 hover:bg-emerald-50 hover:text-emerald-600 transition-colors text-center group">
                                <DollarSign className="mx-auto mb-2 text-gray-400 group-hover:text-emerald-500" size={24} />
                                <span className="text-sm font-medium">Paiements</span>
                            </button>
                            <button onClick={() => router.push('/admin/finance/transactions')} className="p-4 rounded-xl bg-gray-50 hover:bg-orange-50 hover:text-orange-600 transition-colors text-center group">
                                <TrendingUp className="mx-auto mb-2 text-gray-400 group-hover:text-orange-500" size={24} />
                                <span className="text-sm font-medium">Rapports</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: School Vitality & Calendar */}
                <div className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Building size={20} className="text-indigo-600" />
                        Vie de l'École
                    </h3>

                    {/* School Stats */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100 overflow-hidden">
                        <div className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <Users size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Total Étudiants</p>
                                    <p className="text-xs text-gray-500">{stats.studentsThisMonth > 0 ? `+${stats.studentsThisMonth} ce mois` : 'Aucun nouveau'}</p>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-gray-900">{stats.totalStudents}</span>
                        </div>

                        <div className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <Briefcase size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Personnel Actif</p>
                                    <p className="text-xs text-gray-500">Professeurs & Staff</p>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-gray-900">{stats.totalEmployees}</span>
                        </div>
                    </div>

                    {/* Calendar Widget */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <h4 className="font-semibold text-gray-900 text-sm">Calendrier</h4>
                        </div>
                        <div className="p-2 scale-[0.85] origin-top -mb-10">
                            <Calendar />
                        </div>
                    </div>
                </div>
            </div>

            {/* Inscription Modal */}
            {isInscriptionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsInscriptionModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 bg-gray-100 rounded-full transition-colors z-10"
                        >
                            <span className="sr-only">Fermer</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="p-1">
                            <SoutienInscriptionForm
                                onSuccess={() => {
                                    setIsInscriptionModalOpen(false);
                                    loadDashboardData();
                                    // Optional toast here
                                    alert('Inscription réussie !');
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
