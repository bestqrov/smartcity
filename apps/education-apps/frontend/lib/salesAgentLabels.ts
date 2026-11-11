import type { AgentRates, ClientStatus, PackRate, PayoutStatus, SubscriptionPeriod } from './services/salesAgents';

export const PERIODS: SubscriptionPeriod[] = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'];

export const PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
    MONTHLY: 'Mensuel',
    SEMIANNUAL: 'Semestriel',
    YEARLY: 'Annuel',
};

export const BASE_RATE_FIELDS: { key: 'monthlyRate' | 'semiannualRate' | 'yearlyRate'; period: SubscriptionPeriod; short: string }[] = [
    { key: 'monthlyRate', period: 'MONTHLY', short: 'M' },
    { key: 'semiannualRate', period: 'SEMIANNUAL', short: 'S' },
    { key: 'yearlyRate', period: 'YEARLY', short: 'A' },
];

// "M 10 % · S 15 % · A 25 %"
export const formatRates = (rates: Pick<AgentRates, 'monthlyRate' | 'semiannualRate' | 'yearlyRate'>): string =>
    BASE_RATE_FIELDS.map((field) => `${field.short} ${rates[field.key]} %`).join(' · ');

// Several packs share a name across institution types ("Pro"), so the code is shown too.
export const packLabel = (rate: Pick<PackRate, 'packName' | 'packCode'>): string =>
    rate.packName ? (rate.packCode ? `${rate.packName} (${rate.packCode})` : rate.packName) : 'Pack supprimé';

export interface StatusMeta {
    icon: string;
    label: string;
    short: string;
    description: string;
    className: string;
}

export const CLIENT_STATUS_ORDER: ClientStatus[] = ['CONFIRMED', 'ACTIVE_UNPAID', 'PENDING', 'CANCELLED'];

export const CLIENT_STATUS_META: Record<ClientStatus, StatusMeta> = {
    PENDING: {
        icon: '🕒',
        label: "En attente d'activation",
        short: "en attente d'activation",
        description: "L'école s'est inscrite, son compte n'est pas encore activé.",
        className: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700/60',
    },
    ACTIVE_UNPAID: {
        icon: '🔵',
        label: 'Activée, en attente de paiement',
        short: 'en attente de paiement',
        description: "Compte activé, aucun paiement crédité pour l'instant.",
        className: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700/60',
    },
    CONFIRMED: {
        icon: '✅',
        label: 'Confirmée',
        short: 'confirmées',
        description: 'Compte activé et au moins un paiement crédité.',
        className: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700/60',
    },
    CANCELLED: {
        icon: '❌',
        label: 'Annulée',
        short: 'annulées',
        description: 'Compte suspendu. Les commissions déjà gagnées restent dues.',
        className: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700/60',
    },
};

export const PAYOUT_STATUS_ORDER: PayoutStatus[] = ['PAID', 'PARTIAL', 'DUE', 'NONE'];

export const PAYOUT_STATUS_META: Record<PayoutStatus, StatusMeta> = {
    PAID: {
        icon: '💰',
        label: 'Payée',
        short: 'payées',
        description: 'Entièrement couverte par les versements reçus.',
        className: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700/60',
    },
    PARTIAL: {
        icon: '🟡',
        label: 'Partiellement payée',
        short: 'partielles',
        description: 'Couverte en partie ; le reste sera réglé par les prochains versements.',
        className: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-700/60',
    },
    DUE: {
        icon: '⏳',
        label: 'À payer',
        short: 'à payer',
        description: 'Pas encore couverte par un versement.',
        className: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700/60',
    },
    NONE: {
        icon: '—',
        label: 'Sans commission',
        short: 'sans commission',
        description: 'Paiement à 0 % : rien à verser.',
        className: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-300 dark:border-white/15',
    },
};
