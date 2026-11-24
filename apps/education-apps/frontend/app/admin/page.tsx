'use client';

import {
    Users,
    Briefcase,
    TrendingUp,
    DollarSign,
    Plus,
    RefreshCw,
    Wallet,
    AlertCircle,
    ArrowDownRight,
    UserPlus,
    ChevronRight,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getStudents, getStudentAnalytics } from '@/lib/services/students';
import { formationsService } from '@/lib/services/formations';
import { getPaymentAnalytics, getPayments } from '@/lib/services/payments';
import Calendar from '@/components/Calendar';
import SoutienInscriptionForm from '@/components/forms/SoutienInscriptionForm';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import useAuthStore from '@/store/useAuthStore';
import { ChartCard, DonutChart, SplineChart, VBarChart, VibrantKpi } from '@/components/dashboard/Charts';
import { greeting, lastMonths, mad, madShort, num, pct, sumByMonth, todayLabel, topCategories } from '@/lib/dashboard/vibrant';
import type { Payment, Student } from '@/types';

import { useI18n } from '@/lib/i18n/I18nProvider';
import { hasFeature } from '@/lib/packs';
import { useSchoolCycles } from '@/hooks/useSchoolCycles';
import { levelLabel } from '@/lib/schoolLevels';
import { getDuesSummary } from '@/lib/services/schoolMode';
import PlatformBanner from '@/components/dashboard/PlatformBanner';
const CRECHE_SECTIONS: Record<string, string> = { NOURRISSON: 'Nourrissons', MOYENNE: 'Moyenne section', GRANDE: 'Grande section' };

export default function AdminDashboard() {
    const { tr } = useI18n();
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const { profile, loading: profileLoading, refreshProfile } = useSchoolProfile();
    // Without the advanced finance option: no expenses, net, revenue curve or links to the cash book and salaries.
    const advancedFinance = hasFeature(profile.features, 'FINANCE_ANALYTICS');
    const paymentsHref = advancedFinance ? '/admin/finance/paiements' : '/admin/finance/recu';
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeStudents: 0,
        studentsThisMonth: 0,
        totalEmployees: 0,
        revenueThisMonth: 0, // CA Theoretical
        totalReceivedMonth: 0, // Actual Cash In
        expenses: 0, // Total Expenses
        netCash: 0, // Net de Mois
        unpaid: 0,
    });
    const [students, setStudents] = useState<Student[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);

    const [loading, setLoading] = useState(true);
    const [isInscriptionModalOpen, setIsInscriptionModalOpen] = useState(false);
    // School mode: « Impayés » shows unpaid months of the school year + unpaid inscription balances (computed server-side, Morocco time).
    const { schoolMode } = useSchoolCycles();
    const [duesUnpaid, setDuesUnpaid] = useState<number | null>(null);
    useEffect(() => {
        if (!schoolMode) { setDuesUnpaid(null); return; }
        getDuesSummary().then((d) => setDuesUnpaid(d.unpaid)).catch(() => setDuesUnpaid(null));
    }, [schoolMode]);

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
            let activeStudents = 0;
            let studentsThisMonth = 0;
            try {
                const list = await getStudents();
                setStudents(list);
                totalStudents = list.length;
                activeStudents = list.filter((student) => student.active !== false).length;
                studentsThisMonth = list.filter((student: any) => {
                    if (student.createdAt) {
                        const createdDate = new Date(student.createdAt);
                        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
                    }
                    return false;
                }).length;
            } catch (error) {
                console.error('Failed to load students', error);
            }

            // --- 1b. Payments (12-month revenue chart) ---
            try {
                setPayments(await getPayments());
            } catch (error) {
                console.error('Failed to load payments', error);
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
                    activeStudents,
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
                setStats(prev => ({ ...prev, totalStudents, activeStudents, studentsThisMonth, totalEmployees }));
            }

        } catch (error) {
            console.error('Dashboard data load failed', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const isCreche = profile.institutionType === 'CRECHE';
    const studentWord = isCreche ? 'Enfants' : 'Élèves';

    const months = useMemo(() => lastMonths(12), [tr]); // month names follow the language
    const revenuePoints = useMemo(() => sumByMonth(payments, months, (p) => p.date || p.createdAt, (p) => p.amount), [payments, months]);
    const revenue12 = revenuePoints.reduce((s, p) => s + p.value, 0);

    const inscriptionBars = useMemo(() => {
        const all = students.flatMap((s) => s.inscriptions || []);
        return sumByMonth(all, months, (i) => i.date || i.createdAt, () => 1).slice(-6);
    }, [students, months]);

    // A school-mode code (PS2, P3…) shows its level name; free text is translated when known.
    const levelName = (raw?: string | null) => (raw?.trim() ? tr(levelLabel(raw.trim())) : '');
    const levelSlices = useMemo(
        () =>
            topCategories(
                students
                    .filter((s) => s.active !== false)
                    .map((s) => (isCreche && s.crecheSection ? tr(CRECHE_SECTIONS[s.crecheSection]) : levelName(s.schoolLevel)) || tr('Non renseigné'))
            ),
        [students, isCreche, tr]
    );

    const withoutInscription = students.filter((s) => s.active !== false && (s.inscriptions?.length ?? 0) === 0).length;
    const todo = [
        (duesUnpaid ?? stats.unpaid) > 0 && { key: 'unpaid', text: tr('Relancer les impayés ({amount})', { amount: mad(duesUnpaid ?? stats.unpaid) }), href: duesUnpaid !== null ? '/admin/finance/mensualites' : paymentsHref, color: '#D97706' },
        withoutInscription > 0 && { key: 'noinsc', text: tr(isCreche ? '{n} enfants actifs sans inscription' : '{n} élèves actifs sans inscription', { n: num(withoutInscription) }), href: '/admin/inscriptions', color: '#059669' },
        advancedFinance && stats.netCash < 0 && { key: 'net', text: tr('Net du mois négatif ({amount}) : vérifier les dépenses', { amount: mad(stats.netCash) }), href: '/admin/finance/transactions', color: '#BE185D' },
    ].filter(Boolean) as { key: string; text: string; href: string; color: string }[];

    if (loading || profileLoading) return (
        <div className="flex items-center justify-center h-96">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-vib-indigo border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">{tr("Chargement du tableau de bord...")}</p>
            </div>
        </div>
    );

    const firstName = user?.name || '';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <PlatformBanner />

            {/* Greeting & actions */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    {profile.logo && (
                        <img src={profile.logo} alt={tr("Logo")} className="w-14 h-14 rounded-2xl object-contain bg-white shadow-sm shrink-0" />
                    )}
                    <div className="min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">
                            {greeting()}{firstName ? `${tr(',')} ${firstName}` : ''}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 first-letter:uppercase">
                            {todayLabel()}{' '}•{' '}{profile.schoolName}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto">
                    <button
                        onClick={() => { loadDashboardData(false); refreshProfile(); }}
                        className="p-2.5 text-gray-500 hover:text-vib-indigo hover:bg-white dark:text-gray-400 dark:hover:bg-white/10 rounded-xl transition-all active:scale-95"
                        title={tr("Actualiser")}
                        aria-label={tr("Actualiser")}
                    >
                        <RefreshCw size={20} />
                    </button>
                    <button
                        onClick={() => setIsInscriptionModalOpen(true)}
                        className="flex-1 lg:flex-none px-4 py-2.5 bg-vib-ink hover:bg-gray-800 text-white dark:bg-white dark:text-vib-ink dark:hover:bg-gray-200 rounded-2xl font-semibold shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                    >
                        <Plus size={18} />{tr("Nouvelle Inscription")}</button>
                </div>
            </div>

            {/* KPIs */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${advancedFinance ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-4`}>
                <VibrantKpi
                    tone="indigo"
                    label={tr(isCreche ? 'Enfants actifs' : 'Élèves actifs')}
                    value={num(stats.activeStudents)}
                    sub={stats.studentsThisMonth > 0 ? tr("+{v0} ce mois", { v0: num(stats.studentsThisMonth) }) : tr("{v0} au total", { v0: num(stats.totalStudents) })}
                    icon={<Users size={18} />}
                    onClick={() => router.push('/admin/students')}
                />
                <VibrantKpi
                    tone="emerald"
                    label={tr("Encaissé ce mois")}
                    value={mad(stats.totalReceivedMonth)}
                    sub={advancedFinance ? tr("Net du mois : {v0}", { v0: mad(stats.netCash) }) : undefined}
                    icon={<Wallet size={18} />}
                    onClick={() => router.push(paymentsHref)}
                />
                <VibrantKpi
                    tone="amber"
                    label={tr("Impayés")}
                    value={mad(duesUnpaid ?? stats.unpaid)}
                    sub={duesUnpaid !== null ? tr("Mensualités et inscriptions non réglées") : tr("CA théorique : {v0}", { v0: mad(stats.revenueThisMonth) })}
                    icon={<AlertCircle size={18} />}
                    onClick={() => router.push(duesUnpaid !== null ? '/admin/finance/mensualites' : paymentsHref)}
                />
                {advancedFinance && <VibrantKpi
                    tone="pink"
                    label={tr("Dépenses du mois")}
                    value={mad(stats.expenses)}
                    sub={tr("Inclut salaires et charges")}
                    icon={<ArrowDownRight size={18} />}
                    onClick={() => router.push('/admin/finance/transactions')}
                />}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {advancedFinance && (
                    <ChartCard palette="vibrant" className="xl:col-span-2" title={tr("Encaissements mensuels")} hint={tr("12 derniers mois · {v0}", { v0: mad(revenue12) })}>
                        <SplineChart palette="vibrant" points={revenuePoints} rtl={false} format={mad} formatShort={madShort} />
                    </ChartCard>
                )}
                <ChartCard palette="vibrant" className={advancedFinance ? undefined : 'xl:col-span-3'} title={isCreche ? tr("Enfants par section") : tr("Élèves par niveau")} hint={tr(isCreche ? 'Enfants actifs' : 'Élèves actifs')}>
                    <DonutChart
                        palette="vibrant"
                        data={levelSlices}
                        totalLabel={tr(isCreche ? 'enfants' : 'élèves')}
                        formatValue={num}
                        formatPct={pct}
                        empty={tr("Aucun élève actif")}
                    />
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ChartCard palette="vibrant" title={tr("Inscriptions par mois")} hint={tr("6 derniers mois")}>
                    <VBarChart palette="vibrant" data={inscriptionBars} format={num} empty={tr("Aucune inscription sur la période")} />
                </ChartCard>

                <section className="vib-card p-5">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tr("À faire")}</h3>
                    {todo.length === 0 ? (
                        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{tr("Rien d'urgent pour le moment.")}</p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {todo.map((t) => (
                                <li key={t.key}>
                                    <button
                                        type="button"
                                        onClick={() => router.push(t.href)}
                                        className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-start text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                                    >
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
                                        <span className="flex-1">{tr(t.text)}</span>
                                        <ChevronRight size={16} className="shrink-0 text-gray-400" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <h3 className="mt-6 text-sm font-bold text-gray-900 dark:text-white">{tr("Accès rapide")}</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                            { label: tr(studentWord), icon: Users, href: '/admin/students', color: '#059669' },
                            { label: 'Profs', icon: Briefcase, href: '/admin/teachers', color: '#7C3AED' },
                            ...(advancedFinance
                                ? [
                                      { label: 'Paiements', icon: DollarSign, href: '/admin/finance/paiements', color: '#D97706' },
                                      { label: 'Rapports', icon: TrendingUp, href: '/admin/finance/transactions', color: '#4F46E5' },
                                  ]
                                : [
                                      { label: 'Inscriptions', icon: TrendingUp, href: '/admin/inscriptions', color: '#4F46E5' },
                                      { label: 'Reçus', icon: DollarSign, href: '/admin/finance/recu', color: '#D97706' },
                                  ]),
                        ].map((q) => (
                            <button
                                key={q.href}
                                type="button"
                                onClick={() => router.push(q.href)}
                                className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                            >
                                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-white" style={{ backgroundColor: q.color }}>
                                    <q.icon size={15} />
                                </span>
                                {tr(q.label)}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="vib-card p-5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tr("Vie de l'école")}</h3>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                            <UserPlus size={14} /> {num(stats.totalEmployees)}{tr("membres du personnel")}</span>
                    </div>
                    <div className="mt-2 scale-[0.85] origin-top -mb-10">
                        <Calendar />
                    </div>
                </section>
            </div>

            {/* Inscription Modal */}
            {isInscriptionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-vib-card rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsInscriptionModalOpen(false)}
                            className="absolute top-4 end-4 text-gray-400 hover:text-gray-600 p-2 bg-gray-100 dark:bg-white/10 rounded-full transition-colors z-10"
                        >
                            <span className="sr-only">{tr("Fermer")}</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="p-1">
                            <SoutienInscriptionForm
                                onSuccess={() => {
                                    setIsInscriptionModalOpen(false);
                                    loadDashboardData();
                                    alert(tr("Inscription réussie !"));
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
