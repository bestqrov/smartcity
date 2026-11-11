import {
    CLIENT_STATUS_META,
    CLIENT_STATUS_ORDER,
    PAYOUT_STATUS_META,
    PAYOUT_STATUS_ORDER,
    type StatusMeta,
} from '@/lib/salesAgentLabels';
import type { ClientStatus, PayoutStatus } from '@/lib/services/salesAgents';

export function StatusBadge({ meta }: { meta: StatusMeta }) {
    return (
        <span
            title={meta.description}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.className}`}
        >
            <span aria-hidden="true">{meta.icon}</span>
            {meta.label}
        </span>
    );
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
    return <StatusBadge meta={CLIENT_STATUS_META[status]} />;
}

export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
    return <StatusBadge meta={PAYOUT_STATUS_META[status]} />;
}

// Explains every icon of one status kind; shown under the matching table.
export function StatusLegend({ kind }: { kind: 'client' | 'payout' }) {
    const entries =
        kind === 'client'
            ? CLIENT_STATUS_ORDER.map((status) => CLIENT_STATUS_META[status])
            : PAYOUT_STATUS_ORDER.map((status) => PAYOUT_STATUS_META[status]);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 text-xs text-gray-600 space-y-2">
            <div className="font-semibold text-gray-700">Légende</div>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {entries.map((meta) => (
                    <li key={meta.label}>
                        <span aria-hidden="true" className="mr-1">
                            {meta.icon}
                        </span>
                        <b>{meta.label}</b> — {meta.description}
                    </li>
                ))}
            </ul>
            {kind === 'payout' && (
                <p>Les versements reçus sont imputés aux commissions les plus anciennes en premier.</p>
            )}
        </div>
    );
}
