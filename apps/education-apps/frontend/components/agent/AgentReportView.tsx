'use client';

import { useState } from 'react';
import { Copy, Check, Trash2, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { INSTITUTION_TYPE_LABELS, DEFAULT_INSTITUTION_TYPE } from '@/lib/institutionTypes';
import {
    BASE_RATE_FIELDS,
    CLIENT_STATUS_META,
    CLIENT_STATUS_ORDER,
    PERIOD_LABELS,
    packLabel,
} from '@/lib/salesAgentLabels';
import { formatDate, formatDay, formatLastPayment, formatMAD, referralUrl, type AgentReport } from '@/lib/services/salesAgents';
import { ClientStatusBadge, PayoutStatusBadge, StatusLegend } from './StatusBadge';

type Tab = 'schools' | 'commissions' | 'payouts';

interface Props {
    report: AgentReport;
    onDeletePayout?: (payoutId: string) => void; // admin only
    busy?: boolean;
    ratesTitle?: string; // "Mes taux" in the agent space
}

export default function AgentReportView({ report, onDeletePayout, busy, ratesTitle = 'Taux' }: Props) {
    const [tab, setTab] = useState<Tab>('schools');
    const [copied, setCopied] = useState(false);
    const link = referralUrl(report.agent.referralPath);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard unavailable: the link stays visible to copy by hand
        }
    };

    const [monthOpen, setMonthOpen] = useState(false);
    const now = new Date();
    const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
    const thisMonth = ym(now.getFullYear(), now.getMonth() + 1);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = ym(prev.getFullYear(), prev.getMonth() + 1);
    const monthCommissions = report.commissions.filter((c) => c.paidAt.slice(0, 7) === thisMonth);
    const monthEarned = monthCommissions.reduce((total, c) => total + c.commissionAmount, 0);
    const monthCollected = monthCommissions.reduce((total, c) => total + c.amount, 0);
    const lastMonthEarned = report.commissions
        .filter((c) => c.paidAt.slice(0, 7) === lastMonth)
        .reduce((total, c) => total + c.commissionAmount, 0);
    const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const cards: { label: string; value: string; tab: Tab; strong?: boolean }[] = [
        { label: 'Clients', value: String(report.totals.schools), tab: 'schools' },
        { label: 'Clients actifs', value: String(report.totals.activeSchools), tab: 'schools' },
        { label: 'Commissions', value: formatMAD(report.totals.totalCommissions), tab: 'commissions' },
        { label: 'Déjà versé', value: formatMAD(report.totals.totalPayouts), tab: 'payouts' },
        { label: 'Solde dû', value: formatMAD(report.totals.balance), tab: 'commissions', strong: true },
    ];

    const tabs: { id: Tab; label: string }[] = [
        { id: 'schools', label: `Clients (${report.schools.length})` },
        { id: 'commissions', label: `Commissions (${report.commissions.length})` },
        { id: 'payouts', label: `Paiements reçus (${report.payouts.length})` },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-500">Lien commercial :</span>
                <code className="flex-1 min-w-0 truncate text-sm font-semibold text-indigo-700">{link}</code>
                <button onClick={copy} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold">
                    {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copié' : 'Copier'}
                </button>
                <span className="w-full text-xs text-gray-500">
                    Code : <b className="font-mono">{report.agent.code}</b>
                </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <h2 className="font-bold text-gray-800">{ratesTitle}</h2>
                <div className="flex flex-wrap gap-2">
                    {BASE_RATE_FIELDS.map((field) => (
                        <span key={field.key} className="px-3 py-1 rounded-lg bg-gray-100 text-sm text-gray-700">
                            {PERIOD_LABELS[field.period]} : <b>{report.agent[field.key]} %</b>
                        </span>
                    ))}
                </div>
                {report.agent.packRates.length > 0 ? (
                    <div>
                        <div className="text-xs text-gray-500 mb-1">Exceptions par pack</div>
                        <ul className="text-sm text-gray-700 space-y-0.5">
                            {report.agent.packRates.map((rate) => (
                                <li key={`${rate.packId}-${rate.period}`}>
                                    {packLabel(rate)} · {PERIOD_LABELS[rate.period]} : <b>{rate.rate} %</b>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">Pas d&apos;exception par pack.</p>
                )}
            </div>

            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => setMonthOpen((open) => !open)}
                    aria-expanded={monthOpen}
                    className="w-full text-left rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-center gap-4 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                    <TrendingUp className="text-emerald-600 shrink-0" size={32} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-emerald-800">Gagné ce mois-ci — {monthLabel}</div>
                        <div className="text-3xl font-bold text-emerald-700">{formatMAD(monthEarned)}</div>
                        <div className="text-xs text-emerald-800">
                            {monthCommissions.length} paiement{monthCommissions.length > 1 ? 's' : ''} · {formatMAD(monthCollected)} encaissés par les écoles
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Mois dernier : {formatMAD(lastMonthEarned)}</div>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700 shrink-0">
                        <span className="hidden sm:inline">Voir le détail</span>
                        {monthOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </span>
                </button>
                {monthOpen && (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">École</th>
                                    <th className="px-4 py-3">Pack</th>
                                    <th className="px-4 py-3">Période</th>
                                    <th className="px-4 py-3">Paiement</th>
                                    <th className="px-4 py-3">Taux</th>
                                    <th className="px-4 py-3">Commission</th>
                                    <th className="px-4 py-3">Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthCommissions.map((c) => (
                                    <tr key={c.id} className="border-t border-gray-100">
                                        <td className="px-4 py-3 whitespace-nowrap">{formatDay(c.paidAt)}</td>
                                        <td className="px-4 py-3 font-semibold">{c.schoolName}</td>
                                        <td className="px-4 py-3">{c.packName ?? '—'}</td>
                                        <td className="px-4 py-3">{PERIOD_LABELS[c.period]}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{formatMAD(c.amount)}</td>
                                        <td className="px-4 py-3">{c.commissionRate} %</td>
                                        <td className="px-4 py-3 font-bold whitespace-nowrap">{formatMAD(c.commissionAmount)}</td>
                                        <td className="px-4 py-3"><PayoutStatusBadge status={c.payoutStatus} /></td>
                                    </tr>
                                ))}
                                {monthCommissions.length === 0 && (
                                    <tr><td colSpan={8} className="px-4 py-6 text-gray-500">Aucune commission ce mois-ci.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cards.map((card) => (
                    <button
                        type="button"
                        key={card.label}
                        onClick={() => setTab(card.tab)}
                        className={`rounded-2xl border p-4 text-left transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                            card.strong ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'
                        }`}
                    >
                        <div className="text-xs text-gray-500">{card.label}</div>
                        <div className={`mt-1 font-bold ${card.strong ? 'text-emerald-700 text-xl' : 'text-gray-800 text-lg'}`}>{card.value}</div>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2" aria-label="Statut des clients">
                {CLIENT_STATUS_ORDER.map((status) => {
                    const meta = CLIENT_STATUS_META[status];
                    return (
                        <span key={status} title={meta.label} className={`px-3 py-1 rounded-full border text-sm font-semibold ${meta.className}`}>
                            <span aria-hidden="true">{meta.icon}</span> {report.totals.statusCounts[status]} {meta.short}
                        </span>
                    );
                })}
            </div>

            <div className="flex gap-2 overflow-x-auto">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
                            tab === t.id ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
                {tab === 'schools' && (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">École</th>
                                <th className="px-4 py-3">Contact</th>
                                <th className="px-4 py-3">Type / Pack</th>
                                <th className="px-4 py-3">Statut</th>
                                <th className="px-4 py-3">Inscrite le</th>
                                <th className="px-4 py-3">Date d&apos;achat</th>
                                <th className="px-4 py-3">Dernier paiement</th>
                                <th className="px-4 py-3">Total payé</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.schools.map((school) => (
                                <tr key={school.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3 font-semibold">
                                        {school.name}
                                        <div className="text-xs text-gray-500">{school.city || '—'}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {school.ownerName}
                                        <div className="text-xs text-gray-500">{school.ownerPhone || '—'}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {INSTITUTION_TYPE_LABELS[school.institutionType ?? DEFAULT_INSTITUTION_TYPE]}
                                        <div className="text-xs text-gray-500">{school.packName ?? 'Aucun pack'}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <ClientStatusBadge status={school.clientStatus} />
                                    </td>
                                    <td className="px-4 py-3">{formatDate(school.createdAt)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{school.firstPaidAt ? formatDay(school.firstPaidAt) : '—'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">{formatLastPayment(school)}</td>
                                    <td className="px-4 py-3">{formatMAD(school.totalPaid)}</td>
                                </tr>
                            ))}
                            {report.schools.length === 0 && (
                                <tr><td colSpan={8} className="px-4 py-6 text-gray-500">Aucun client pour le moment.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}

                {tab === 'commissions' && (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">École</th>
                                <th className="px-4 py-3">Pack</th>
                                <th className="px-4 py-3">Paiement</th>
                                <th className="px-4 py-3">Taux</th>
                                <th className="px-4 py-3">Commission</th>
                                <th className="px-4 py-3">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.commissions.map((c) => (
                                <tr key={c.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3">{formatDay(c.paidAt)}</td>
                                    <td className="px-4 py-3 font-semibold">{c.schoolName}</td>
                                    <td className="px-4 py-3">{c.packName ?? '—'}</td>
                                    <td className="px-4 py-3">
                                        {formatMAD(c.amount)} <span className="text-xs text-gray-500">({PERIOD_LABELS[c.period]})</span>
                                    </td>
                                    <td className="px-4 py-3">{c.commissionRate} %</td>
                                    <td className="px-4 py-3 font-bold">{formatMAD(c.commissionAmount)}</td>
                                    <td className="px-4 py-3">
                                        <PayoutStatusBadge status={c.payoutStatus} />
                                        {c.payoutStatus === 'PARTIAL' && (
                                            <div className="mt-1 text-xs text-gray-500">
                                                {formatMAD(c.paidAmount)} versé · reste {formatMAD(c.commissionAmount - c.paidAmount)}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {report.commissions.length === 0 && (
                                <tr><td colSpan={7} className="px-4 py-6 text-gray-500">Aucune commission pour le moment.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}

                {tab === 'payouts' && (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Montant</th>
                                <th className="px-4 py-3">Note</th>
                                {onDeletePayout && <th className="px-4 py-3" />}
                            </tr>
                        </thead>
                        <tbody>
                            {report.payouts.map((p) => (
                                <tr key={p.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3">{formatDay(p.paidAt)}</td>
                                    <td className="px-4 py-3 font-bold">{formatMAD(p.amount)}</td>
                                    <td className="px-4 py-3">{p.note || '—'}</td>
                                    {onDeletePayout && (
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => onDeletePayout(p.id)} disabled={busy} className="text-red-600 hover:text-red-800" aria-label="Supprimer">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {report.payouts.length === 0 && (
                                <tr><td colSpan={onDeletePayout ? 4 : 3} className="px-4 py-6 text-gray-500">Aucun paiement pour le moment.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {tab === 'schools' && <StatusLegend kind="client" />}
            {tab === 'commissions' && <StatusLegend kind="payout" />}
        </div>
    );
}
