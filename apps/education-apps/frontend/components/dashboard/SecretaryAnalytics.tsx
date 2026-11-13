'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, ChevronRight, Users, Wallet, BookOpen } from 'lucide-react';
import { getInscriptionAnalytics, getInscriptions, InscriptionAnalytics } from '@/lib/services/inscriptions';
import { getStudents } from '@/lib/services/students';
import { ChartCard, DonutChart, SplineChart, VBarChart, VibrantKpi } from '@/components/dashboard/Charts';
import { lastMonths, mad, madShort, num, pct, sumByMonth } from '@/lib/dashboard/vibrant';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import type { Inscription, Student } from '@/types';

export default function SecretaryAnalytics() {
    const router = useRouter();
    const { profile } = useSchoolProfile();
    const [analytics, setAnalytics] = useState<InscriptionAnalytics | null>(null);
    const [inscriptions, setInscriptions] = useState<Inscription[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
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
            // Chart data: optional, the KPIs still show if these fail.
            const [ins, stu] = await Promise.allSettled([getInscriptions(), getStudents()]);
            if (ins.status === 'fulfilled') setInscriptions(ins.value);
            if (stu.status === 'fulfilled') setStudents(stu.value);
        };

        fetchAnalytics();
    }, []);

    const months = useMemo(() => lastMonths(12), []);
    const amountPoints = useMemo(() => sumByMonth(inscriptions, months, (i) => i.date || i.createdAt, (i) => i.amount), [inscriptions, months]);
    const countBars = useMemo(() => sumByMonth(inscriptions, months, (i) => i.date || i.createdAt, () => 1).slice(-6), [inscriptions, months]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-vib-indigo"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300">
                {error}
            </div>
        );
    }

    if (!analytics) return null;

    const isCreche = profile.institutionType === 'CRECHE';
    const activeStudents = students.filter((s) => s.active !== false);
    const withoutInscription = activeStudents.filter((s) => (s.inscriptions?.length ?? 0) === 0).length;
    const typeSlices = [
        { key: 'soutien', label: isCreche ? 'Enfants' : 'Soutien scolaire', value: analytics.monthly.soutien, tone: 0 },
        { key: 'formation', label: 'Formation pro', value: analytics.monthly.formation, tone: 4 },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <VibrantKpi
                    tone="indigo"
                    label="Inscriptions du jour"
                    value={num(analytics.daily.count)}
                    sub={mad(analytics.daily.total)}
                    icon={<CalendarCheck size={18} />}
                    onClick={() => router.push('/secretary/inscriptions')}
                />
                <VibrantKpi
                    tone="emerald"
                    label="Montant du mois"
                    value={mad(analytics.monthly.total)}
                    sub="Total des inscriptions"
                    icon={<Wallet size={18} />}
                    onClick={() => router.push('/secretary/recus')}
                />
                <VibrantKpi
                    tone="violet"
                    label="Inscriptions du mois"
                    value={num(analytics.monthly.count)}
                    sub={`${num(analytics.monthly.soutien)} soutien · ${num(analytics.monthly.formation)} formation`}
                    icon={<BookOpen size={18} />}
                />
                <VibrantKpi
                    tone="pink"
                    label={isCreche ? 'Enfants actifs' : 'Élèves actifs'}
                    value={num(activeStudents.length)}
                    sub={`${num(students.length)} au total`}
                    icon={<Users size={18} />}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ChartCard palette="vibrant" className="xl:col-span-2" title="Montant des inscriptions" hint="12 derniers mois">
                    <SplineChart palette="vibrant" points={amountPoints} rtl={false} format={mad} formatShort={madShort} />
                </ChartCard>
                <ChartCard palette="vibrant" title="Inscriptions du mois par type">
                    <DonutChart palette="vibrant" data={typeSlices} totalLabel="inscriptions" formatValue={num} formatPct={pct} empty="Aucune inscription ce mois" />
                </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartCard palette="vibrant" title="Inscriptions par mois" hint="6 derniers mois">
                    <VBarChart palette="vibrant" data={countBars} format={num} empty="Aucune inscription sur la période" />
                </ChartCard>
                <section className="vib-card p-5">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">À faire</h3>
                    {withoutInscription === 0 ? (
                        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Rien d&apos;urgent pour le moment.</p>
                    ) : (
                        <button
                            type="button"
                            onClick={() => router.push('/secretary/inscriptions')}
                            className="mt-3 w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                        >
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#059669]" aria-hidden="true" />
                            <span className="flex-1">{num(withoutInscription)} {isCreche ? 'enfants' : 'élèves'} actifs sans inscription</span>
                            <ChevronRight size={16} className="shrink-0 text-gray-400" />
                        </button>
                    )}
                </section>
            </div>
        </div>
    );
}
