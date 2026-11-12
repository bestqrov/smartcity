'use client';

// Super admin platform dashboard: filters, KPI cards, charts and tables. Platform-level data only
// (schools, subscription payments, sales agents); nothing from inside a school.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { RotateCcw, X } from 'lucide-react';
import { DEFAULT_INSTITUTION_TYPE, INSTITUTION_TYPES, type InstitutionType } from '@/lib/institutionTypes';
import { PERIODS } from '@/lib/salesAgentLabels';
import type { SchoolStatus } from '@/lib/services/schools';
import type { SubscriptionPeriod } from '@/lib/services/salesAgents';
import type { PlatformAgent, PlatformOverview, PlatformPayment, PlatformSchool } from '@/lib/services/platform';
import type { PlatformMessages } from '@/lib/platform/messages';
import type { AgentLang } from '@/lib/agent/messages';
import { fmtDay, fmtMAD, fmtMADShort, fmtMonthShort, fmtMonthYear, fmtNumber } from '@/lib/agent/format';
import { AgentAvatar } from '@/components/agent/AgentAvatar';
import { cardClass, ChartCard, DonutChart, HBarChart, KpiCard, SplineChart, VBarChart } from '@/components/dashboard/Charts';
import { emptyRowClass, mutedClass, rowClass, Slicer, TabButton, tdClass, theadClass, thClass } from '@/components/dashboard/ui';

type Tab = 'schools' | 'payments' | 'agents';
type Panel = 'new' | 'revenue' | 'trials' | null;

interface Filters {
    month: string; // YYYY-MM
    status: SchoolStatus | '';
    type: InstitutionType | '';
    pack: string;
    agent: string; // '' = all, 'none' = no sales agent, otherwise the agent id
}
const NO_FILTERS: Filters = { month: '', status: '', type: '', pack: '', agent: '' };
const SCHOOL_STATUSES: SchoolStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED'];
const STATUS_TONE: Record<SchoolStatus, number> = { ACTIVE: 0, PENDING: 1, SUSPENDED: 3 };
const PERIOD_TONE: Record<SubscriptionPeriod, number> = { MONTHLY: 0, SEMIANNUAL: 1, YEARLY: 2 };
const STATUS_BADGE: Record<SchoolStatus, string> = {
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200',
    PENDING: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
    SUSPENDED: 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200',
};
const DAY_MS = 86_400_000;

const ym = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthDate = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
const sum = <T,>(list: T[], pick: (item: T) => number) => list.reduce((total, item) => total + pick(item), 0);
const deltaOf = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0);

const linkClass = 'font-semibold text-espresso-800 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-500 dark:text-espresso-100';

interface Props {
    data: PlatformOverview;
    lang: AgentLang;
    m: PlatformMessages;
}

export default function PlatformDashboard({ data: overview, lang, m }: Props) {
    const [tab, setTab] = useState<Tab>('schools');
    const [panel, setPanel] = useState<Panel>(null);
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const money = (value: number) => fmtMAD(value, lang);
    const moneyShort = (value: number) => fmtMADShort(value, lang);
    const count = (value: number) => fmtNumber(value, lang);

    const now = new Date();
    const thisMonth = ym(now);
    const lastMonth = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const d = useMemo(() => {
        const schoolById = new Map<string, PlatformSchool>(overview.schools.map((school) => [school.id, school]));
        const agentById = new Map<string, PlatformAgent>(overview.agents.map((agent) => [agent.id, agent]));
        const typeOf = (school: PlatformSchool | undefined) => school?.institutionType ?? DEFAULT_INSTITUTION_TYPE;
        const agentMatches = (id: string | null) => !filters.agent || (filters.agent === 'none' ? id === null : id === filters.agent);

        // Everything except the month filter: the trend chart and the "this month" KPIs ignore it.
        const schoolOk = (school: PlatformSchool) =>
            (!filters.status || school.status === filters.status) &&
            (!filters.type || typeOf(school) === filters.type) &&
            (!filters.pack || school.packName === filters.pack) &&
            agentMatches(school.salesAgent?.id ?? null);
        const paymentOk = (p: PlatformPayment) => {
            const school = schoolById.get(p.schoolId);
            return (
                (!filters.status || school?.status === filters.status) &&
                (!filters.type || typeOf(school) === filters.type) &&
                (!filters.pack || p.packName === filters.pack) &&
                agentMatches(p.salesAgentId)
            );
        };
        const schoolsAnyMonth = overview.schools.filter(schoolOk);
        const paymentsAnyMonth = overview.payments.filter(paymentOk);
        const schools = filters.month ? schoolsAnyMonth.filter((s) => ym(new Date(s.createdAt)) === filters.month) : schoolsAnyMonth;
        const payments = filters.month ? paymentsAnyMonth.filter((p) => p.paidAt.slice(0, 7) === filters.month) : paymentsAnyMonth;
        return { schoolById, agentById, typeOf, schoolsAnyMonth, paymentsAnyMonth, schools, payments };
    }, [overview, filters]);

    const anyFilter = Object.values(filters).some(Boolean);
    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

    // ---- KPIs
    const newThisMonth = d.schoolsAnyMonth.filter((s) => ym(new Date(s.createdAt)) === thisMonth);
    const newLastMonth = d.schoolsAnyMonth.filter((s) => ym(new Date(s.createdAt)) === lastMonth).length;
    const monthPayments = d.paymentsAnyMonth.filter((p) => p.paidAt.slice(0, 7) === thisMonth);
    const monthRevenue = sum(monthPayments, (p) => p.amount);
    const lastMonthRevenue = sum(
        d.paymentsAnyMonth.filter((p) => p.paidAt.slice(0, 7) === lastMonth),
        (p) => p.amount
    );
    const totalRevenue = sum(d.payments, (p) => p.amount);
    const owed = overview.agents.filter((a) => a.totals.balance > 0);
    const commissionsDue = sum(owed, (a) => a.totals.balance);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const trials = d.schoolsAnyMonth
        .filter((s) => {
            if ((s.status !== 'PENDING' && s.status !== 'ACTIVE') || !s.trialEndsAt || s.totalPaid > 0) return false;
            const end = new Date(s.trialEndsAt).getTime();
            return end >= startOfToday && end <= Date.now() + 7 * DAY_MS;
        })
        .sort((a, b) => new Date(a.trialEndsAt!).getTime() - new Date(b.trialEndsAt!).getTime());
    const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - startOfToday) / DAY_MS));
    const activeCount = d.schools.filter((s) => s.status === 'ACTIVE').length;

    // ---- charts
    const trend = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const key = ym(date);
        return {
            key,
            label: fmtMonthShort(date, lang),
            title: fmtMonthYear(date, lang),
            value: sum(
                d.paymentsAnyMonth.filter((p) => p.paidAt.slice(0, 7) === key),
                (p) => p.amount
            ),
        };
    });
    const byType = INSTITUTION_TYPES.map((type) => ({
        key: type,
        label: m.institution_type[type],
        value: d.schools.filter((s) => d.typeOf(s) === type).length,
    }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value);
    const packCounts = new Map<string, number>();
    d.schools.forEach((s) => packCounts.set(s.packName ?? '', (packCounts.get(s.packName ?? '') ?? 0) + 1));
    const byPack = Array.from(packCounts, ([pack, n]) => ({ key: pack || '-', label: pack || m.no_pack, value: n }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
    const byStatus = SCHOOL_STATUSES.map((status) => ({
        key: status,
        label: m.school_status[status],
        value: d.schools.filter((s) => s.status === status).length,
        tone: STATUS_TONE[status],
    }));
    const byPeriod = PERIODS.map((period) => ({
        key: period,
        label: m.period[period],
        value: sum(
            d.payments.filter((p) => p.period === period),
            (p) => p.amount
        ),
        tone: PERIOD_TONE[period],
    }));
    const revenueByAgent = new Map<string, number>();
    d.payments.forEach((p) => p.salesAgentId && revenueByAgent.set(p.salesAgentId, (revenueByAgent.get(p.salesAgentId) ?? 0) + p.amount));
    const topAgents = Array.from(revenueByAgent, ([id, value]) => {
        const agent = d.agentById.get(id);
        const name = agent?.name ?? id;
        return { key: id, label: name, value, icon: <AgentAvatar src={agent?.avatar} name={name} size={18} className="bg-espresso-100 text-espresso-800 dark:bg-espresso-700 dark:text-espresso-50" /> };
    }).sort((a, b) => b.value - a.value);

    // ---- filter options
    const monthKeys = Array.from(
        new Set([...overview.payments.map((p) => p.paidAt.slice(0, 7)), ...overview.schools.map((s) => ym(new Date(s.createdAt))), ...(filters.month ? [filters.month] : [])])
    ).sort((a, b) => b.localeCompare(a));
    const typesPresent = INSTITUTION_TYPES.filter((type) => overview.schools.some((s) => d.typeOf(s) === type));
    const packNames = Array.from(new Set([...overview.schools.map((s) => s.packName), ...overview.payments.map((p) => p.packName)].filter((p): p is string => !!p))).sort((a, b) =>
        a.localeCompare(b)
    );

    // ---- agents tab: revenue / commissions follow the filters, the balance is global
    const agentRows = overview.agents
        .filter((a) => !filters.agent || (filters.agent !== 'none' && a.id === filters.agent))
        .map((a) => {
            const mine = d.payments.filter((p) => p.salesAgentId === a.id);
            return {
                agent: a,
                schools: d.schools.filter((s) => s.salesAgent?.id === a.id).length,
                revenue: sum(mine, (p) => p.amount),
                commissions: sum(mine, (p) => p.commissionAmount),
            };
        });

    const statusBadge = (status: SchoolStatus) => (
        <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}>{m.school_status[status]}</span>
    );
    const tabs: { id: Tab; label: string; count: number }[] = [
        { id: 'schools', label: m.tab_schools, count: d.schools.length },
        { id: 'payments', label: m.tab_payments, count: d.payments.length },
        { id: 'agents', label: m.tab_agents, count: agentRows.length },
    ];
    const togglePanel = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));
    const closeButton = (
        <button
            type="button"
            onClick={() => setPanel(null)}
            aria-label={m.close}
            className="rounded-md p-1 text-gray-500 hover:bg-espresso-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-500 dark:text-espresso-200 dark:hover:bg-espresso-800"
        >
            <X size={18} aria-hidden="true" />
        </button>
    );
    const typeLabel = (s: PlatformSchool) => m.institution_type[d.typeOf(s)];
    const agentCell = (s: PlatformSchool) => s.salesAgent?.name ?? '—';

    return (
        <div className="space-y-4">
            {/* ---- filter bar */}
            <section aria-label={m.filters_label} className="rounded-xl bg-espresso-800 p-3 dark:bg-espresso-ink sm:p-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
                    <Slicer id="f-month" label={m.filter_month} value={filters.month} onChange={(v) => setFilter('month', v)} options={monthKeys.map((key) => ({ value: key, label: fmtMonthYear(monthDate(key), lang) }))} all={m.all} />
                    <Slicer id="f-status" label={m.filter_school_status} value={filters.status} onChange={(v) => setFilter('status', v as SchoolStatus | '')} options={SCHOOL_STATUSES.map((s) => ({ value: s, label: m.school_status[s] }))} all={m.all} />
                    <Slicer id="f-type" label={m.filter_type} value={filters.type} onChange={(v) => setFilter('type', v as InstitutionType | '')} options={typesPresent.map((type) => ({ value: type, label: m.institution_type[type] }))} all={m.all} />
                    <Slicer id="f-pack" label={m.filter_pack} value={filters.pack} onChange={(v) => setFilter('pack', v)} options={packNames.map((p) => ({ value: p, label: p }))} all={m.all} />
                    <Slicer
                        id="f-agent"
                        label={m.filter_agent}
                        value={filters.agent}
                        onChange={(v) => setFilter('agent', v)}
                        options={[{ value: 'none', label: m.no_agent }, ...overview.agents.map((a) => ({ value: a.id, label: a.name }))]}
                        all={m.all}
                    />
                </div>
                {anyFilter && (
                    <div className="mt-2 flex justify-end">
                        <button
                            type="button"
                            onClick={() => setFilters(NO_FILTERS)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-espresso-100 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-200"
                        >
                            <RotateCcw size={13} aria-hidden="true" /> {m.reset_filters}
                        </button>
                    </div>
                )}
            </section>

            {/* ---- KPI row */}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
                <KpiCard label={m.kpi_schools} value={count(d.schools.length)} sub={`${m.kpi_active} : ${count(activeCount)}`} onClick={() => setTab('schools')} />
                <KpiCard
                    label={m.kpi_new_month}
                    value={count(newThisMonth.length)}
                    sub={m.last_month_value(count(newLastMonth))}
                    delta={newThisMonth.length || newLastMonth ? { value: deltaOf(newThisMonth.length, newLastMonth), text: `${deltaOf(newThisMonth.length, newLastMonth) > 0 ? '+' : ''}${deltaOf(newThisMonth.length, newLastMonth)} %`, label: m.vs_last_month } : null}
                    onClick={() => togglePanel('new')}
                    expanded={panel === 'new'}
                    highlight
                />
                <KpiCard
                    label={m.kpi_revenue_month}
                    value={money(monthRevenue)}
                    sub={m.last_month_value(money(lastMonthRevenue))}
                    delta={monthRevenue || lastMonthRevenue ? { value: deltaOf(monthRevenue, lastMonthRevenue), text: `${deltaOf(monthRevenue, lastMonthRevenue) > 0 ? '+' : ''}${deltaOf(monthRevenue, lastMonthRevenue)} %`, label: m.vs_last_month } : null}
                    onClick={() => togglePanel('revenue')}
                    expanded={panel === 'revenue'}
                    highlight
                />
                <KpiCard label={m.kpi_revenue_total} value={money(totalRevenue)} sub={m.payments_count(d.payments.length)} onClick={() => setTab('payments')} />
                <KpiCard label={m.kpi_commissions_due} value={money(commissionsDue)} sub={m.kpi_agents_owed(owed.length)} onClick={() => setTab('agents')} />
                <KpiCard label={m.kpi_trials} value={count(trials.length)} sub={m.kpi_trials_sub} onClick={() => togglePanel('trials')} expanded={panel === 'trials'} />
            </div>

            {/* ---- KPI detail panel */}
            {panel && (
                <section className={`${cardClass} overflow-hidden`} aria-label={panel === 'new' ? m.detail_new(fmtMonthYear(now, lang)) : panel === 'revenue' ? m.detail_revenue(fmtMonthYear(now, lang)) : m.detail_trials}>
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div>
                            <h3 className="text-sm font-bold text-espresso-900 dark:text-espresso-50">
                                {panel === 'new' ? m.detail_new(fmtMonthYear(now, lang)) : panel === 'revenue' ? m.detail_revenue(fmtMonthYear(now, lang)) : m.detail_trials}
                            </h3>
                            {panel === 'revenue' && <p className={mutedClass}>{m.payments_count(monthPayments.length)} · {money(monthRevenue)}</p>}
                        </div>
                        {closeButton}
                    </div>
                    <div className="max-h-[60vh] overflow-auto">
                        <table className="w-full text-start text-sm">
                            <thead className={theadClass}>
                                {panel === 'revenue' ? (
                                    <tr>
                                        <th className={thClass}>{m.col_date}</th>
                                        <th className={thClass}>{m.col_school}</th>
                                        <th className={thClass}>{m.col_pack}</th>
                                        <th className={thClass}>{m.col_period}</th>
                                        <th className={thClass}>{m.col_amount}</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className={thClass}>{m.col_school}</th>
                                        <th className={thClass}>{m.col_type}</th>
                                        <th className={thClass}>{m.col_pack}</th>
                                        <th className={thClass}>{m.col_agent}</th>
                                        <th className={thClass}>{panel === 'new' ? m.col_registered : m.col_trial_end}</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="text-gray-800 dark:text-espresso-100">
                                {panel === 'revenue' &&
                                    monthPayments.map((p) => (
                                        <tr key={p.id} className={rowClass}>
                                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{fmtDay(p.paidAt, lang)}</td>
                                            <td className={`${tdClass} font-semibold`}>{p.schoolName}</td>
                                            <td className={tdClass}>{p.packName ?? '—'}</td>
                                            <td className={tdClass}>{m.period[p.period]}</td>
                                            <td className={`${tdClass} whitespace-nowrap font-bold tabular-nums`}>{money(p.amount)}</td>
                                        </tr>
                                    ))}
                                {panel !== 'revenue' &&
                                    (panel === 'new' ? newThisMonth : trials).map((s) => (
                                        <tr key={s.id} className={rowClass}>
                                            <td className={`${tdClass} font-semibold`}>{s.name}</td>
                                            <td className={tdClass}>{typeLabel(s)}</td>
                                            <td className={tdClass}>{s.packName ?? '—'}</td>
                                            <td className={tdClass}>{agentCell(s)}</td>
                                            <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                                                {panel === 'new' ? fmtDay(s.createdAt, lang) : `${fmtDay(s.trialEndsAt!, lang)} · ${m.days_left(daysLeft(s.trialEndsAt!))}`}
                                            </td>
                                        </tr>
                                    ))}
                                {((panel === 'new' && newThisMonth.length === 0) || (panel === 'revenue' && monthPayments.length === 0) || (panel === 'trials' && trials.length === 0)) && (
                                    <tr>
                                        <td colSpan={5} className={emptyRowClass}>
                                            {panel === 'new' ? m.no_new : panel === 'revenue' ? m.no_month_payment : m.no_trials}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ---- charts */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <ChartCard title={m.chart_revenue_trend} hint={m.chart_trend_hint} className="sm:col-span-2 lg:col-span-2">
                    <SplineChart
                        points={trend}
                        rtl={lang === 'ar'}
                        format={money}
                        formatShort={moneyShort}
                        selectedKey={filters.month}
                        onSelect={(key) => setFilter('month', filters.month === key ? '' : key)}
                        selectLabel={(title) => `${m.filter_month} : ${title}`}
                    />
                </ChartCard>
                <ChartCard title={m.chart_schools_status}>
                    <DonutChart data={byStatus} totalLabel={m.chart_total} formatValue={count} formatPct={(p) => `${p} %`} empty={m.chart_empty} />
                </ChartCard>
                <ChartCard title={m.chart_schools_type}>
                    <HBarChart data={byType} format={count} empty={m.chart_empty} />
                </ChartCard>
                <ChartCard title={m.chart_schools_pack}>
                    <VBarChart data={byPack} format={count} empty={m.chart_empty} />
                </ChartCard>
                <ChartCard title={m.chart_revenue_period}>
                    <DonutChart data={byPeriod} totalLabel={m.chart_total} formatValue={moneyShort} formatPct={(p) => `${p} %`} empty={m.chart_empty} />
                </ChartCard>
                <ChartCard title={m.chart_top_agents} className="sm:col-span-2 lg:col-span-3">
                    <HBarChart data={topAgents} format={moneyShort} empty={m.chart_empty} />
                </ChartCard>
            </div>

            {/* ---- tables */}
            <section id="platform-tables" className="scroll-mt-28 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={m.tabs_label}>
                        {tabs.map((t) => (
                            <TabButton key={t.id} id={`tab-${t.id}`} selected={tab === t.id} controls="platform-tabpanel" onClick={() => setTab(t.id)}>
                                {t.label} <span className="tabular-nums">({t.count})</span>
                            </TabButton>
                        ))}
                    </div>
                    {tab !== 'payments' && (
                        <Link href={tab === 'schools' ? '/admin/schools' : '/admin/sales-agents'} className={`${linkClass} shrink-0 text-xs`}>
                            {tab === 'schools' ? m.manage_schools : m.manage_agents}
                        </Link>
                    )}
                </div>

                <div id="platform-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={`${cardClass} max-h-[70vh] overflow-auto`}>
                    <table className="w-full text-start text-sm">
                        <thead className={theadClass}>
                            {tab === 'schools' && (
                                <tr>
                                    <th className={thClass}>{m.col_school}</th>
                                    <th className={thClass}>{m.col_type}</th>
                                    <th className={thClass}>{m.col_pack}</th>
                                    <th className={thClass}>{m.col_status}</th>
                                    <th className={thClass}>{m.col_agent}</th>
                                    <th className={thClass}>{m.col_registered}</th>
                                    <th className={thClass}>{m.col_trial_end}</th>
                                    <th className={thClass}>{m.col_total_paid}</th>
                                    <th className={thClass}>{m.col_last_payment}</th>
                                </tr>
                            )}
                            {tab === 'payments' && (
                                <tr>
                                    <th className={thClass}>{m.col_date}</th>
                                    <th className={thClass}>{m.col_school}</th>
                                    <th className={thClass}>{m.col_pack}</th>
                                    <th className={thClass}>{m.col_period}</th>
                                    <th className={thClass}>{m.col_amount}</th>
                                    <th className={thClass}>{m.col_agent}</th>
                                    <th className={thClass}>{m.col_commission}</th>
                                </tr>
                            )}
                            {tab === 'agents' && (
                                <tr>
                                    <th className={thClass}>{m.col_avatar}</th>
                                    <th className={thClass}>{m.col_name}</th>
                                    <th className={thClass}>{m.col_code}</th>
                                    <th className={thClass}>{m.col_schools}</th>
                                    <th className={thClass}>{m.col_revenue}</th>
                                    <th className={thClass}>{m.col_commissions}</th>
                                    <th className={thClass}>{m.col_balance}</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="text-gray-800 dark:text-espresso-100">
                            {tab === 'schools' &&
                                d.schools.map((s) => (
                                    <tr key={s.id} className={rowClass}>
                                        <td className={`${tdClass} font-semibold`}>
                                            {s.name}
                                            <div className={`${mutedClass} font-normal`}>{s.city || '—'}</div>
                                        </td>
                                        <td className={tdClass}>{typeLabel(s)}</td>
                                        <td className={tdClass}>{s.packName ?? '—'}</td>
                                        <td className={tdClass}>{statusBadge(s.status)}</td>
                                        <td className={tdClass}>{agentCell(s)}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{fmtDay(s.createdAt, lang)}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{s.trialEndsAt ? fmtDay(s.trialEndsAt, lang) : '—'}</td>
                                        <td className={`${tdClass} whitespace-nowrap font-bold tabular-nums`}>{money(s.totalPaid)}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{s.lastPaidAt ? fmtDay(s.lastPaidAt, lang) : '—'}</td>
                                    </tr>
                                ))}
                            {tab === 'payments' &&
                                d.payments.map((p) => (
                                    <tr key={p.id} className={rowClass}>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{fmtDay(p.paidAt, lang)}</td>
                                        <td className={`${tdClass} font-semibold`}>{p.schoolName}</td>
                                        <td className={tdClass}>{p.packName ?? '—'}</td>
                                        <td className={tdClass}>{m.period[p.period]}</td>
                                        <td className={`${tdClass} whitespace-nowrap font-bold tabular-nums`}>{money(p.amount)}</td>
                                        <td className={tdClass}>{p.salesAgentName ?? '—'}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{money(p.commissionAmount)}</td>
                                    </tr>
                                ))}
                            {tab === 'agents' &&
                                agentRows.map(({ agent, schools, revenue, commissions }) => (
                                    <tr key={agent.id} className={rowClass}>
                                        <td className={tdClass}>
                                            <AgentAvatar src={agent.avatar} name={agent.name} size={28} className="bg-espresso-100 text-espresso-800 dark:bg-espresso-700 dark:text-espresso-50" />
                                        </td>
                                        <td className={tdClass}>
                                            <Link href={`/admin/sales-agents/${agent.id}`} className={linkClass}>
                                                {agent.name}
                                            </Link>
                                            {agent.isHouse && <span className={`${mutedClass} ms-2`}>{m.house}</span>}
                                            {!agent.active && <span className="ms-2 text-xs font-semibold text-red-600 dark:text-red-300">{m.inactive}</span>}
                                        </td>
                                        <td className={`${tdClass} font-mono`}>{agent.code}</td>
                                        <td className={`${tdClass} tabular-nums`}>{count(schools)}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{money(revenue)}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{money(commissions)}</td>
                                        <td className={`${tdClass} whitespace-nowrap font-bold tabular-nums`}>{money(agent.totals.balance)}</td>
                                    </tr>
                                ))}
                            {((tab === 'schools' && d.schools.length === 0) || (tab === 'payments' && d.payments.length === 0) || (tab === 'agents' && agentRows.length === 0)) && (
                                <tr>
                                    <td colSpan={9} className={emptyRowClass}>
                                        {tab === 'schools' ? m.no_schools : tab === 'payments' ? m.no_payments : m.no_agents}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {tab === 'agents' && <p className={mutedClass}>{m.balance_note}</p>}
            </section>
        </div>
    );
}
