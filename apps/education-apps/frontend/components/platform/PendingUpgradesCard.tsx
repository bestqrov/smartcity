// frontend/components/platform/PendingUpgradesCard.tsx
'use client';

import Link from 'next/link';
import type { PlatformPendingUpgrade } from '@/lib/services/platform';
import type { PlatformMessages } from '@/lib/platform/messages';
import type { AgentLang } from '@/lib/agent/messages';
import { fmtDay, fmtMAD } from '@/lib/agent/format';
import { cardClass } from '@/components/dashboard/Charts';

interface Props {
    upgrades: PlatformPendingUpgrade[];
    lang: AgentLang;
    m: PlatformMessages;
}

// Follow-up list for the sales team: the backend sorts by deadline, so overdue rows come first.
export default function PendingUpgradesCard({ upgrades, lang, m }: Props) {
    if (upgrades.length === 0) return null;
    const now = Date.now();

    return (
        <section className={`${cardClass} p-4`} aria-label={m.upgrades_title}>
            <h3 className="text-sm font-bold text-espresso-900 dark:text-espresso-50">{m.upgrades_title}</h3>
            <p className="mb-3 text-xs text-espresso-600 dark:text-espresso-300">{m.upgrades_hint}</p>
            <ul className="divide-y divide-espresso-100 dark:divide-espresso-700">
                {upgrades.map((upgrade) => {
                    const overdue = new Date(upgrade.dueAt).getTime() < now;
                    return (
                        <li key={upgrade.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                            <div className="min-w-0">
                                <Link href="/admin/schools" className="font-semibold text-espresso-900 hover:underline dark:text-espresso-50">
                                    {upgrade.schoolName}
                                </Link>
                                <p className="text-xs text-espresso-600 dark:text-espresso-300">
                                    {m.upgrades_change} : {upgrade.fromPackName ?? '—'} → {upgrade.toPackName} · {m.upgrades_price} : {fmtMAD(upgrade.toMonthlyPrice, lang)} · {m.upgrades_date} : {fmtDay(upgrade.createdAt, lang)}
                                </p>
                            </div>
                            <span
                                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                    overdue
                                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200'
                                        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                                }`}
                            >
                                {overdue ? `${m.upgrades_overdue} · ` : `${m.upgrades_due} : `}
                                {fmtDay(upgrade.dueAt, lang)}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
