import {
    CLIENT_STATUS_META,
    CLIENT_STATUS_ORDER,
    PAYOUT_STATUS_META,
    PAYOUT_STATUS_ORDER,
    type StatusMeta,
} from '@/lib/salesAgentLabels';
import type { AgentMessages, StatusText } from '@/lib/agent/messages';
import type { ClientStatus, PayoutStatus } from '@/lib/services/salesAgents';

// `text` overrides the French label/description of `meta` (agent space in Arabic).
export function StatusBadge({ meta, text }: { meta: StatusMeta; text?: StatusText }) {
    return (
        <span
            title={text?.description ?? meta.description}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.className}`}
        >
            <span aria-hidden="true">{meta.icon}</span>
            {text?.label ?? meta.label}
        </span>
    );
}

export function ClientStatusBadge({ status, m }: { status: ClientStatus; m?: AgentMessages }) {
    return <StatusBadge meta={CLIENT_STATUS_META[status]} text={m?.client_status[status]} />;
}

export function PayoutStatusBadge({ status, m }: { status: PayoutStatus; m?: AgentMessages }) {
    return <StatusBadge meta={PAYOUT_STATUS_META[status]} text={m?.payout_status[status]} />;
}

// Explains every icon of one status kind; shown under the matching table.
export function StatusLegend({ kind, m }: { kind: 'client' | 'payout'; m?: AgentMessages }) {
    const entries =
        kind === 'client'
            ? CLIENT_STATUS_ORDER.map((status) => ({ meta: CLIENT_STATUS_META[status], text: m?.client_status[status] }))
            : PAYOUT_STATUS_ORDER.map((status) => ({ meta: PAYOUT_STATUS_META[status], text: m?.payout_status[status] }));

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-xs text-gray-600 space-y-2 dark:bg-espresso-900 dark:border-espresso-800 dark:text-espresso-200">
            <div className="font-semibold text-gray-700 dark:text-espresso-100">{m?.legend ?? 'Légende'}</div>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {entries.map(({ meta, text }) => (
                    <li key={meta.label}>
                        <span aria-hidden="true" className="me-1">
                            {meta.icon}
                        </span>
                        <b>{text?.label ?? meta.label}</b> — {text?.description ?? meta.description}
                    </li>
                ))}
            </ul>
            {kind === 'payout' && (
                <p>{m?.legend_payout_note ?? 'Les versements reçus sont imputés aux commissions les plus anciennes en premier.'}</p>
            )}
        </div>
    );
}
