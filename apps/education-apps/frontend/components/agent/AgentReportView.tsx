'use client';

// Sales agent report: filters, KPI cards, charts, tables, rates and referral link.
// Shared by the agent space (French or Arabic) and the super admin agent page (French, the default).
import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Trash2, Eye, X, RotateCcw, Link2 } from 'lucide-react';
import { INSTITUTION_TYPES, DEFAULT_INSTITUTION_TYPE, type InstitutionType } from '@/lib/institutionTypes';
import { BASE_RATE_FIELDS, CLIENT_STATUS_META, CLIENT_STATUS_ORDER, PERIODS } from '@/lib/salesAgentLabels';
import { referralUrl, type AgentReport, type ClientStatus, type RateTableRow, type SubscriptionPeriod } from '@/lib/services/salesAgents';
import { agentMessages, type AgentLang, type AgentMessages } from '@/lib/agent/messages';
import { fmtDate, fmtDay, fmtMAD, fmtMADShort, fmtMonthShort, fmtMonthYear, fmtNumber } from '@/lib/agent/format';
import type { AgentSection } from '@/lib/agent/prefs';
import { ClientStatusBadge, PayoutStatusBadge, StatusLegend } from './StatusBadge';
import { cardClass, ChartCard, DonutChart, HBarChart, KpiCard, SplineChart, VBarChart } from '@/components/dashboard/Charts';
import { emptyRowClass, mutedClass, rowClass, Slicer, TabButton, tdClass, theadClass, thClass } from '@/components/dashboard/ui';

type Tab = 'schools' | 'commissions' | 'payouts';
type School = AgentReport['schools'][number];
type Commission = AgentReport['commissions'][number];

interface Props {
    report: AgentReport;
    onDeletePayout?: (payoutId: string) => void; // admin only
    busy?: boolean;
    ratesTitle?: string; // "Mes taux" in the agent space
    lang?: AgentLang; // 'fr' by default (admin page)
    m?: AgentMessages; // defaults to the dictionary of `lang`
    focus?: { id: AgentSection; n: number }; // sidebar request to show a section
}

interface Filters {
    month: string; // YYYY-MM
    status: ClientStatus | '';
    period: SubscriptionPeriod | '';
    type: InstitutionType | '';
    pack: string;
}
const NO_FILTERS: Filters = { month: '', status: '', period: '', type: '', pack: '' };

const STATUS_TONE: Record<ClientStatus, number> = { CONFIRMED: 0, ACTIVE_UNPAID: 2, PENDING: 1, CANCELLED: 3 };
const PERIOD_TONE: Record<SubscriptionPeriod, number> = { MONTHLY: 0, SEMIANNUAL: 1, YEARLY: 2 };

const ym = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthDate = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1);
const sum = <T,>(list: T[], pick: (item: T) => number) => list.reduce((total, item) => total + pick(item), 0);

// Example commission in MAD for one cell; null when the pack has no price.
const exampleCommission = (row: RateTableRow, period: SubscriptionPeriod): number | null => {
    const price = period === 'YEARLY' ? row.yearlyPrice : row.monthlyPrice;
    if (!price) return null;
    const base = period === 'SEMIANNUAL' ? price * 6 : price;
    return (base * row.rates[period]) / 100;
};

// "10 %" or "20–25 %"
const rateRange = (rows: RateTableRow[], period: SubscriptionPeriod): string => {
    const values = rows.map((row) => row.rates[period]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? `${min} %` : `${min}–${max} %`;
};

function RateTable({ rows, m, lang }: { rows: RateTableRow[]; m: AgentMessages; lang: AgentLang }) {
    const [openType, setOpenType] = useState<InstitutionType | null>(null);
    const groups = INSTITUTION_TYPES.map((type) => ({ type, rows: rows.filter((row) => row.institutionTypes.includes(type)) })).filter(
        (group) => group.rows.length > 0
    );
    if (groups.length === 0) return null;
    const open = groups.find((group) => group.type === openType);
    const hasException = (list: RateTableRow[]) => list.some((row) => PERIODS.some((period) => row.exceptions[period]));

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => {
                    const isOpen = openType === group.type;
                    const label = m.institution_type[group.type];
                    return (
                        <div
                            key={group.type}
                            className={`rounded-xl border p-3 text-sm ${
                                isOpen
                                    ? 'border-espresso-400 bg-espresso-50 dark:border-espresso-500 dark:bg-espresso-800/60'
                                    : 'border-espresso-100 bg-white dark:border-espresso-800 dark:bg-espresso-950/40'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold text-espresso-900 dark:text-espresso-50">
                                        {label}
                                        {hasException(group.rows) && (
                                            <span className="ms-1 text-amber-600 dark:text-amber-400" role="img" aria-label={m.specific_rates}>
                                                ★
                                            </span>
                                        )}
                                    </div>
                                    <div className={mutedClass}>{m.packs_count(group.rows.length)}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpenType(isOpen ? null : group.type)}
                                    aria-expanded={isOpen}
                                    aria-label={m.details_of(label)}
                                    className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-espresso-700 hover:bg-espresso-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-500 dark:text-espresso-200 dark:hover:bg-espresso-800"
                                >
                                    <Eye size={14} aria-hidden="true" /> {m.details}
                                </button>
                            </div>
                            <div className="mt-1 text-xs tabular-nums text-gray-700 dark:text-espresso-200">
                                {PERIODS.map((period) => `${m.period_initial[period]} ${rateRange(group.rows, period)}`).join(' · ')}
                            </div>
                        </div>
                    );
                })}
            </div>
            {open && (
                <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase text-gray-500 dark:text-espresso-300">{m.institution_type[open.type]}</div>
                    <div className="overflow-x-auto rounded-xl border border-espresso-100 dark:border-espresso-800">
                        <table className="w-full min-w-[480px] text-start text-sm">
                            <thead className={theadClass}>
                                <tr>
                                    <th className={thClass}>{m.col_pack}</th>
                                    {PERIODS.map((period) => (
                                        <th key={period} className={thClass}>
                                            {m.period[period]}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {open.rows.map((row) => (
                                    <tr key={row.packId} className={rowClass}>
                                        <td className={`${tdClass} font-medium text-espresso-900 dark:text-espresso-50`}>{row.packName}</td>
                                        {PERIODS.map((period) => {
                                            const example = exampleCommission(row, period);
                                            const special = row.exceptions[period];
                                            return (
                                                <td key={period} className={`${tdClass} ${special ? 'bg-amber-50 dark:bg-amber-900/25' : ''}`}>
                                                    <div className="font-semibold tabular-nums text-espresso-900 dark:text-espresso-50">
                                                        {special && (
                                                            <span className="me-1 text-amber-600 dark:text-amber-400" role="img" aria-label={m.specific_rate_pack}>
                                                                ★
                                                            </span>
                                                        )}
                                                        {row.rates[period]} %
                                                    </div>
                                                    {example !== null && (
                                                        <div className={`${mutedClass} tabular-nums`}>
                                                            {period === 'SEMIANNUAL' ? '≈ ' : ''}
                                                            {fmtMAD(example, lang)}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className={mutedClass}>
                        {hasException(open.rows) && (
                            <span className="me-3">
                                <span className="text-amber-600 dark:text-amber-400">★</span> {m.specific_rate_pack}
                            </span>
                        )}
                        {m.rates_amount_note}
                    </p>
                </div>
            )}
        </div>
    );
}

export default function AgentReportView({ report, onDeletePayout, busy, ratesTitle, lang = 'fr', m = agentMessages[lang], focus }: Props) {
    const [tab, setTab] = useState<Tab>('schools');
    const [copied, setCopied] = useState(false);
    const [monthOpen, setMonthOpen] = useState(false);
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const link = referralUrl(report.agent.referralPath);
    const money = (value: number) => fmtMAD(value, lang);
    const moneyShort = (value: number) => fmtMADShort(value, lang);

    // Sidebar entries of the agent space: open the matching tab and scroll to the section.
    useEffect(() => {
        if (!focus || focus.n === 0) return;
        const tabOf: Partial<Record<AgentSection, Tab>> = { clients: 'schools', commissions: 'commissions', payouts: 'payouts' };
        const nextTab = tabOf[focus.id];
        if (nextTab) setTab(nextTab);
        const target = nextTab ? 'agent-tables' : `agent-${focus.id}`;
        const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        return () => cancelAnimationFrame(frame);
    }, [focus]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard unavailable: the link stays visible to copy by hand
        }
    };

    const now = new Date();
    const thisMonth = ym(now);
    const lastMonth = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const data = useMemo(() => {
        const schoolByName = new Map<string, School>(report.schools.map((school) => [school.name, school]));
        const typeOf = (school: School | undefined) => school?.institutionType ?? DEFAULT_INSTITUTION_TYPE;
        const schoolMatches = (school: School) =>
            (!filters.status || school.clientStatus === filters.status) &&
            (!filters.type || typeOf(school) === filters.type) &&
            (!filters.pack || school.packName === filters.pack);
        // Commissions carry the school name only: status / type filters go through it.
        const commissionMatches = (c: Commission) => {
            if (filters.period && c.period !== filters.period) return false;
            if (filters.pack && c.packName !== filters.pack) return false;
            if (filters.status || filters.type) {
                const school = schoolByName.get(c.schoolName);
                if (!school) return false;
                if (filters.status && school.clientStatus !== filters.status) return false;
                if (filters.type && typeOf(school) !== filters.type) return false;
            }
            return true;
        };
        const schools = report.schools.filter(schoolMatches);
        const commissionsAnyMonth = report.commissions.filter(commissionMatches);
        const commissions = filters.month ? commissionsAnyMonth.filter((c) => c.paidAt.slice(0, 7) === filters.month) : commissionsAnyMonth;
        const payouts = filters.month ? report.payouts.filter((p) => p.paidAt.slice(0, 7) === filters.month) : report.payouts;
        return { schoolByName, typeOf, schools, commissionsAnyMonth, commissions, payouts };
    }, [report, filters]);

    const anyFilter = Object.values(filters).some(Boolean);
    const otherThanMonth = !!(filters.status || filters.period || filters.type || filters.pack);

    // ---- KPIs
    const monthCommissions = data.commissionsAnyMonth.filter((c) => c.paidAt.slice(0, 7) === thisMonth);
    const monthEarned = sum(monthCommissions, (c) => c.commissionAmount);
    const monthCollected = sum(monthCommissions, (c) => c.amount);
    const lastMonthEarned = sum(
        data.commissionsAnyMonth.filter((c) => c.paidAt.slice(0, 7) === lastMonth),
        (c) => c.commissionAmount
    );
    const monthDelta =
        lastMonthEarned > 0
            ? Math.round(((monthEarned - lastMonthEarned) / lastMonthEarned) * 100)
            : monthEarned > 0
              ? 100
              : 0;

    const clientsCount = data.schools.length;
    const activeCount = anyFilter
        ? data.schools.filter((s) => s.clientStatus === 'CONFIRMED' || s.clientStatus === 'ACTIVE_UNPAID').length
        : report.totals.activeSchools;
    const totalCommissions = anyFilter ? sum(data.commissions, (c) => c.commissionAmount) : report.totals.totalCommissions;
    const totalPaid = otherThanMonth
        ? sum(data.commissions, (c) => c.paidAmount)
        : filters.month
          ? sum(data.payouts, (p) => p.amount)
          : report.totals.totalPayouts;
    const balance = anyFilter ? sum(data.commissions, (c) => c.commissionAmount - c.paidAmount) : report.totals.balance;

    // ---- charts
    const byType = INSTITUTION_TYPES.map((type) => ({
        key: type,
        label: m.institution_type[type],
        value: sum(
            data.commissions.filter((c) => data.typeOf(data.schoolByName.get(c.schoolName)) === type),
            (c) => c.commissionAmount
        ),
    }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value);

    const packCounts = new Map<string, number>();
    data.schools.forEach((s) => packCounts.set(s.packName ?? '', (packCounts.get(s.packName ?? '') ?? 0) + 1));
    const byPack = Array.from(packCounts, ([pack, count]) => ({ key: pack || '-', label: pack || m.no_pack, value: count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    const trend = Array.from({ length: 12 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const key = ym(date);
        return {
            key,
            label: fmtMonthShort(date, lang),
            title: fmtMonthYear(date, lang),
            value: sum(
                data.commissionsAnyMonth.filter((c) => c.paidAt.slice(0, 7) === key),
                (c) => c.commissionAmount
            ),
        };
    });

    const byStatus = CLIENT_STATUS_ORDER.map((status) => ({
        key: status,
        label: m.client_status[status].label,
        value: data.schools.filter((s) => s.clientStatus === status).length,
        tone: STATUS_TONE[status],
    }));
    const byPeriod = PERIODS.map((period) => ({
        key: period,
        label: m.period[period],
        value: sum(
            data.commissions.filter((c) => c.period === period),
            (c) => c.commissionAmount
        ),
        tone: PERIOD_TONE[period],
    }));

    // ---- filter options
    const monthKeys = Array.from(
        new Set([...report.commissions.map((c) => c.paidAt.slice(0, 7)), ...report.payouts.map((p) => p.paidAt.slice(0, 7)), ...(filters.month ? [filters.month] : [])])
    ).sort((a, b) => b.localeCompare(a));
    const packNames = Array.from(
        new Set([...report.schools.map((s) => s.packName), ...report.commissions.map((c) => c.packName)].filter((p): p is string => !!p))
    ).sort((a, b) => a.localeCompare(b));
    const typesPresent = INSTITUTION_TYPES.filter((type) => report.schools.some((s) => data.typeOf(s) === type));
    const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

    const pct = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
    const lastPayment = (school: School) =>
        school.lastPaidAt ? `${fmtDay(school.lastPaidAt, lang)}${school.lastPeriod ? ` · ${m.period[school.lastPeriod]}` : ''}` : '—';

    const tabs: { id: Tab; label: string; count: number }[] = [
        { id: 'schools', label: m.tab_clients, count: data.schools.length },
        { id: 'commissions', label: m.tab_commissions, count: data.commissions.length },
        { id: 'payouts', label: m.tab_payouts, count: data.payouts.length },
    ];

    return (
        <div className="space-y-4">
            {/* ---- filter bar */}
            <section id="agent-overview" aria-label={m.filters_label} className="scroll-mt-28 rounded-xl bg-espresso-800 p-3 dark:bg-espresso-ink sm:p-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
                    <Slicer
                        id="f-month"
                        label={m.filter_month}
                        value={filters.month}
                        onChange={(v) => setFilter('month', v)}
                        options={monthKeys.map((key) => ({ value: key, label: fmtMonthYear(monthDate(key), lang) }))}
                        all={m.all}
                    />
                    <Slicer
                        id="f-status"
                        label={m.filter_status}
                        value={filters.status}
                        onChange={(v) => setFilter('status', v as ClientStatus | '')}
                        options={CLIENT_STATUS_ORDER.map((status) => ({ value: status, label: m.client_status[status].label }))}
                        all={m.all}
                    />
                    <Slicer
                        id="f-period"
                        label={m.filter_period}
                        value={filters.period}
                        onChange={(v) => setFilter('period', v as SubscriptionPeriod | '')}
                        options={PERIODS.map((period) => ({ value: period, label: m.period[period] }))}
                        all={m.all}
                    />
                    <Slicer
                        id="f-type"
                        label={m.filter_type}
                        value={filters.type}
                        onChange={(v) => setFilter('type', v as InstitutionType | '')}
                        options={typesPresent.map((type) => ({ value: type, label: m.institution_type[type] }))}
                        all={m.all}
                    />
                    <Slicer id="f-pack" label={m.filter_pack} value={filters.pack} onChange={(v) => setFilter('pack', v)} options={packNames.map((p) => ({ value: p, label: p }))} all={m.all} />
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
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                <KpiCard label={m.stat_clients} value={fmtNumber(clientsCount, lang)} sub={`${m.stat_active} : ${fmtNumber(activeCount, lang)}`} onClick={() => setTab('schools')} />
                <KpiCard
                    label={m.stat_commissions}
                    value={money(totalCommissions)}
                    sub={anyFilter ? m.kpi_filtered : undefined}
                    onClick={() => setTab('commissions')}
                />
                <KpiCard
                    label={`${m.earned_month} — ${fmtMonthYear(now, lang)}`}
                    value={money(monthEarned)}
                    sub={`${m.last_month} : ${money(lastMonthEarned)}`}
                    delta={monthEarned || lastMonthEarned ? { value: monthDelta, text: `${monthDelta > 0 ? '+' : ''}${monthDelta} %`, label: m.vs_last_month } : null}
                    onClick={() => setMonthOpen((open) => !open)}
                    expanded={monthOpen}
                    highlight
                />
                <KpiCard
                    label={m.stat_paid}
                    value={money(totalPaid)}
                    sub={totalCommissions > 0 && !filters.month ? m.paid_share(pct(totalPaid, totalCommissions)) : undefined}
                    onClick={() => setTab('payouts')}
                />
                <div className="col-span-2 lg:col-span-1">
                    <KpiCard label={m.stat_balance} value={money(balance)} sub={anyFilter ? m.kpi_filtered : undefined} onClick={() => setTab('commissions')} />
                </div>
            </div>

            {/* ---- this month's details */}
            {monthOpen && (
                <section className={`${cardClass} overflow-hidden`} aria-label={m.month_details(fmtMonthYear(now, lang))}>
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                        <div>
                            <h3 className="text-sm font-bold text-espresso-900 dark:text-espresso-50">{m.month_details(fmtMonthYear(now, lang))}</h3>
                            <p className={mutedClass}>{m.month_payments(monthCommissions.length, money(monthCollected))}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMonthOpen(false)}
                            aria-label={m.close}
                            className="rounded-md p-1 text-gray-500 hover:bg-espresso-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-500 dark:text-espresso-200 dark:hover:bg-espresso-800"
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                    <div className="max-h-[60vh] overflow-auto">
                        <table className="w-full text-start text-sm">
                            <thead className={theadClass}>
                                <tr>
                                    <th className={thClass}>{m.col_date}</th>
                                    <th className={thClass}>{m.col_school}</th>
                                    <th className={thClass}>{m.col_pack}</th>
                                    <th className={thClass}>{m.col_period}</th>
                                    <th className={thClass}>{m.col_payment}</th>
                                    <th className={thClass}>{m.col_rate}</th>
                                    <th className={thClass}>{m.col_commission}</th>
                                    <th className={thClass}>{m.col_status}</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-800 dark:text-espresso-100">
                                {monthCommissions.map((c) => (
                                    <tr key={c.id} className={rowClass}>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{fmtDay(c.paidAt, lang)}</td>
                                        <td className={`${tdClass} font-semibold`}>{c.schoolName}</td>
                                        <td className={tdClass}>{c.packName ?? '—'}</td>
                                        <td className={tdClass}>{m.period[c.period]}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{money(c.amount)}</td>
                                        <td className={`${tdClass} tabular-nums`}>{c.commissionRate} %</td>
                                        <td className={`${tdClass} whitespace-nowrap font-bold tabular-nums`}>{money(c.commissionAmount)}</td>
                                        <td className={tdClass}>
                                            <PayoutStatusBadge status={c.payoutStatus} m={m} />
                                        </td>
                                    </tr>
                                ))}
                                {monthCommissions.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className={emptyRowClass}>
                                            {m.no_month_commission}
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
                <ChartCard title={m.chart_trend} hint={m.chart_trend_hint} className="sm:col-span-2 lg:col-span-2">
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
                <ChartCard title={m.chart_status}>
                    <DonutChart
                        data={byStatus}
                        totalLabel={m.chart_total}
                        formatValue={(v) => fmtNumber(v, lang)}
                        formatPct={(p) => `${p} %`}
                        empty={m.chart_empty}
                    />
                </ChartCard>
                <ChartCard title={m.chart_by_type}>
                    <HBarChart data={byType} format={moneyShort} empty={m.chart_empty} />
                </ChartCard>
                <ChartCard title={m.chart_by_pack}>
                    <VBarChart data={byPack} format={(v) => fmtNumber(v, lang)} empty={m.chart_empty} />
                </ChartCard>
                <ChartCard title={m.chart_period}>
                    <DonutChart data={byPeriod} totalLabel={m.chart_total} formatValue={moneyShort} formatPct={(p) => `${p} %`} empty={m.chart_empty} />
                </ChartCard>
            </div>

            {/* ---- status chips */}
            <div className="flex flex-wrap gap-2" role="group" aria-label={m.client_status_label}>
                {CLIENT_STATUS_ORDER.map((status) => {
                    const meta = CLIENT_STATUS_META[status];
                    const active = filters.status === status;
                    return (
                        <button
                            type="button"
                            key={status}
                            title={m.client_status[status].label}
                            aria-pressed={active}
                            onClick={() => setFilter('status', active ? '' : status)}
                            className={`rounded-full border px-3 py-1 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-500 ${meta.className} ${active ? 'ring-2 ring-espresso-600 dark:ring-espresso-300' : ''}`}
                        >
                            <span aria-hidden="true">{meta.icon}</span> <span className="tabular-nums">{report.totals.statusCounts[status]}</span> {m.client_status[status].short}
                        </button>
                    );
                })}
            </div>

            {/* ---- tables */}
            <section id="agent-tables" className="scroll-mt-28 space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={m.tabs_label}>
                    {tabs.map((t) => (
                        <TabButton key={t.id} id={`tab-${t.id}`} selected={tab === t.id} controls="agent-tabpanel" onClick={() => setTab(t.id)}>
                            {t.label} <span className="tabular-nums">({t.count})</span>
                        </TabButton>
                    ))}
                </div>

                <div id="agent-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className={`${cardClass} max-h-[70vh] overflow-auto`}>
                    {tab === 'schools' && (
                        <table className="w-full text-start text-sm">
                            <thead className={theadClass}>
                                <tr>
                                    <th className={thClass}>{m.col_school}</th>
                                    <th className={thClass}>{m.col_contact}</th>
                                    <th className={thClass}>{m.col_type_pack}</th>
                                    <th className={thClass}>{m.col_status}</th>
                                    <th className={thClass}>{m.col_registered}</th>
                                    <th className={thClass}>{m.col_purchase}</th>
                                    <th className={thClass}>{m.col_last_payment}</th>
                                    <th className={thClass}>{m.col_total_paid}</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-800 dark:text-espresso-100">
                                {data.schools.map((school) => (
                                    <tr key={school.id} className={rowClass}>
                                        <td className={`${tdClass} font-semibold`}>
                                            {school.name}
                                            <div className={`${mutedClass} font-normal`}>{school.city || '—'}</div>
                                        </td>
                                        <td className={tdClass}>
                                            {school.ownerName}
                                            <div className={mutedClass} dir="ltr">
                                                {school.ownerPhone || '—'}
                                            </div>
                                        </td>
                                        <td className={tdClass}>
                                            {m.institution_type[data.typeOf(school)]}
                                            <div className={mutedClass}>{school.packName ?? m.no_pack}</div>
                                        </td>
                                        <td className={tdClass}>
                                            <ClientStatusBadge status={school.clientStatus} m={m} />
                                        </td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{fmtDate(school.createdAt, lang)}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{school.firstPaidAt ? fmtDay(school.firstPaidAt, lang) : '—'}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{lastPayment(school)}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{money(school.totalPaid)}</td>
                                    </tr>
                                ))}
                                {data.schools.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className={emptyRowClass}>
                                            {m.no_clients}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {tab === 'commissions' && (
                        <table className="w-full text-start text-sm">
                            <thead className={theadClass}>
                                <tr>
                                    <th className={thClass}>{m.col_date}</th>
                                    <th className={thClass}>{m.col_school}</th>
                                    <th className={thClass}>{m.col_pack}</th>
                                    <th className={thClass}>{m.col_payment}</th>
                                    <th className={thClass}>{m.col_rate}</th>
                                    <th className={thClass}>{m.col_commission}</th>
                                    <th className={thClass}>{m.col_status}</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-800 dark:text-espresso-100">
                                {data.commissions.map((c) => (
                                    <tr key={c.id} className={rowClass}>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{fmtDay(c.paidAt, lang)}</td>
                                        <td className={`${tdClass} font-semibold`}>{c.schoolName}</td>
                                        <td className={tdClass}>{c.packName ?? '—'}</td>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>
                                            {money(c.amount)} <span className={mutedClass}>({m.period[c.period]})</span>
                                        </td>
                                        <td className={`${tdClass} tabular-nums`}>{c.commissionRate} %</td>
                                        <td className={`${tdClass} whitespace-nowrap font-bold tabular-nums`}>{money(c.commissionAmount)}</td>
                                        <td className={tdClass}>
                                            <PayoutStatusBadge status={c.payoutStatus} m={m} />
                                            {c.payoutStatus === 'PARTIAL' && (
                                                <div className={`mt-1 ${mutedClass} tabular-nums`}>{m.partial_detail(money(c.paidAmount), money(c.commissionAmount - c.paidAmount))}</div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {data.commissions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className={emptyRowClass}>
                                            {m.no_commissions}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}

                    {tab === 'payouts' && (
                        <table className="w-full text-start text-sm">
                            <thead className={theadClass}>
                                <tr>
                                    <th className={thClass}>{m.col_date}</th>
                                    <th className={thClass}>{m.col_amount}</th>
                                    <th className={thClass}>{m.col_note}</th>
                                    {onDeletePayout && (
                                        <th className={thClass}>
                                            <span className="sr-only">{m.delete}</span>
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-gray-800 dark:text-espresso-100">
                                {data.payouts.map((p) => (
                                    <tr key={p.id} className={rowClass}>
                                        <td className={`${tdClass} whitespace-nowrap tabular-nums`}>{fmtDay(p.paidAt, lang)}</td>
                                        <td className={`${tdClass} whitespace-nowrap font-bold tabular-nums`}>{money(p.amount)}</td>
                                        <td className={tdClass}>{p.note || '—'}</td>
                                        {onDeletePayout && (
                                            <td className={`${tdClass} text-end`}>
                                                <button
                                                    type="button"
                                                    onClick={() => onDeletePayout(p.id)}
                                                    disabled={busy}
                                                    className="rounded p-1 text-red-600 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                                                    aria-label={m.delete}
                                                >
                                                    <Trash2 size={16} aria-hidden="true" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {data.payouts.length === 0 && (
                                    <tr>
                                        <td colSpan={onDeletePayout ? 4 : 3} className={emptyRowClass}>
                                            {m.no_payouts}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {tab === 'schools' && <StatusLegend kind="client" m={m} />}
                {tab === 'commissions' && <StatusLegend kind="payout" m={m} />}
            </section>

            {/* ---- referral link + rates */}
            <section className={`${cardClass} p-4`} aria-label={m.referral_link}>
                <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-espresso-800 dark:text-espresso-100">
                        <Link2 size={16} aria-hidden="true" /> {m.referral_link}
                    </span>
                    <code dir="ltr" className="min-w-0 flex-1 truncate rounded-md bg-espresso-50 px-2 py-1 text-sm font-semibold text-espresso-800 dark:bg-espresso-950 dark:text-espresso-100">
                        {link}
                    </code>
                    <button
                        type="button"
                        onClick={copy}
                        aria-label={m.copy_label}
                        className="flex items-center gap-2 rounded-lg bg-espresso-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-espresso-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-espresso-400 focus-visible:ring-offset-2 dark:bg-espresso-200 dark:text-espresso-950 dark:hover:bg-espresso-100 dark:focus-visible:ring-offset-espresso-900"
                    >
                        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? m.copied : m.copy}
                    </button>
                    <span className={`w-full ${mutedClass}`} aria-live="polite">
                        {m.code} : <b className="font-mono">{report.agent.code}</b>
                    </span>
                </div>
            </section>

            <section id="agent-rates" className={`${cardClass} scroll-mt-28 space-y-3 p-4`}>
                <h2 className="font-bold text-espresso-900 dark:text-espresso-50">{ratesTitle ?? m.rates}</h2>
                <div className="flex flex-wrap gap-2">
                    {BASE_RATE_FIELDS.map((field) => (
                        <span key={field.key} className="rounded-lg bg-espresso-50 px-3 py-1 text-sm text-espresso-800 dark:bg-espresso-950 dark:text-espresso-100">
                            {m.period[field.period]} : <b className="tabular-nums">{report.agent[field.key]} %</b>
                        </span>
                    ))}
                </div>
                <RateTable rows={report.rateTable ?? []} m={m} lang={lang} />
            </section>
        </div>
    );
}
