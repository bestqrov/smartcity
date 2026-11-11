import { roundMoney } from './salesAgents.validation';

export type ClientStatus = 'PENDING' | 'ACTIVE_UNPAID' | 'CONFIRMED' | 'CANCELLED';
export type PayoutStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'NONE';

// A school seen from its agent: only payments credited to that agent count. A suspended school keeps the
// commissions it already generated (still owed); only its client status becomes CANCELLED.
export const clientStatus = (schoolStatus: string, creditedPayments: number): ClientStatus => {
    if (schoolStatus === 'SUSPENDED') return 'CANCELLED';
    if (schoolStatus === 'PENDING') return 'PENDING';
    return creditedPayments > 0 ? 'CONFIRMED' : 'ACTIVE_UNPAID';
};

export const countStatuses = (statuses: ClientStatus[]): Record<ClientStatus, number> => {
    const counts: Record<ClientStatus, number> = { PENDING: 0, ACTIVE_UNPAID: 0, CONFIRMED: 0, CANCELLED: 0 };
    for (const status of statuses) counts[status] += 1;
    return counts;
};

export interface Allocation {
    payoutStatus: PayoutStatus;
    paidAmount: number;
}

interface Allocatable {
    id: string;
    paidAt: Date;
    createdAt: Date;
    commissionAmount: number;
}

// Payouts are not linked to commissions: their total is spent on the oldest commissions first (payment date,
// then recording time). Any excess (negative balance) is not carried anywhere.
export const allocatePayouts = (commissions: Allocatable[], totalPayouts: number): Map<string, Allocation> => {
    const ordered = [...commissions].sort(
        (a, b) => a.paidAt.getTime() - b.paidAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime()
    );
    let remaining = roundMoney(Math.max(totalPayouts, 0));
    const allocation = new Map<string, Allocation>();
    for (const commission of ordered) {
        if (commission.commissionAmount <= 0) {
            allocation.set(commission.id, { payoutStatus: 'NONE', paidAmount: 0 });
            continue;
        }
        const paid = roundMoney(Math.min(remaining, commission.commissionAmount));
        remaining = roundMoney(remaining - paid);
        const payoutStatus: PayoutStatus = paid >= commission.commissionAmount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'DUE';
        allocation.set(commission.id, { payoutStatus, paidAmount: paid });
    }
    return allocation;
};
