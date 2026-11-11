import { allocatePayouts, clientStatus, countStatuses, type Allocation } from './salesAgents.statuses';

describe('clientStatus', () => {
    it.each<[string, number, string]>([
        ['PENDING', 0, 'PENDING'],
        ['PENDING', 2, 'PENDING'],
        ['ACTIVE', 0, 'ACTIVE_UNPAID'],
        ['ACTIVE', 1, 'CONFIRMED'],
        ['SUSPENDED', 0, 'CANCELLED'],
        ['SUSPENDED', 3, 'CANCELLED'],
    ])('a %s school with %i credited payment(s) is %s', (status, payments, expected) => {
        expect(clientStatus(status, payments)).toBe(expected);
    });
});

describe('countStatuses', () => {
    it('counts every status, including absent ones', () => {
        expect(countStatuses(['CONFIRMED', 'CONFIRMED', 'CANCELLED'])).toEqual({
            PENDING: 0,
            ACTIVE_UNPAID: 0,
            CONFIRMED: 2,
            CANCELLED: 1,
        });
    });
});

const commission = (id: string, day: string, commissionAmount: number, recordedOn = day) => ({
    id,
    paidAt: new Date(day),
    createdAt: new Date(recordedOn),
    commissionAmount,
});

const summary = (allocation: Map<string, Allocation>) =>
    Object.fromEntries([...allocation].map(([id, entry]) => [id, [entry.payoutStatus, entry.paidAmount]]));

describe('allocatePayouts', () => {
    it('leaves everything due without payouts', () => {
        const result = allocatePayouts([commission('a', '2026-01-01', 100), commission('b', '2026-02-01', 50)], 0);
        expect(summary(result)).toEqual({ a: ['DUE', 0], b: ['DUE', 0] });
    });

    it('marks everything paid when payouts cover the commissions exactly', () => {
        const result = allocatePayouts([commission('a', '2026-01-01', 100), commission('b', '2026-02-01', 50)], 150);
        expect(summary(result)).toEqual({ a: ['PAID', 100], b: ['PAID', 50] });
    });

    it('spends payouts on the oldest commission first and leaves the next one partial', () => {
        // Listed newest first, as the report returns them.
        const result = allocatePayouts([commission('b', '2026-02-01', 50), commission('a', '2026-01-01', 100)], 120);
        expect(summary(result)).toEqual({ a: ['PAID', 100], b: ['PARTIAL', 20] });
    });

    it('marks everything paid when payouts exceed the commissions', () => {
        const result = allocatePayouts([commission('a', '2026-01-01', 100), commission('b', '2026-02-01', 50)], 500);
        expect(summary(result)).toEqual({ a: ['PAID', 100], b: ['PAID', 50] });
    });

    it('breaks a tie on the payment date with the recording time', () => {
        const result = allocatePayouts(
            [commission('late', '2026-01-01', 100, '2026-01-03'), commission('early', '2026-01-01', 100, '2026-01-02')],
            100
        );
        expect(summary(result)).toEqual({ early: ['PAID', 100], late: ['DUE', 0] });
    });

    it('marks zero commissions NONE without spending anything on them', () => {
        const result = allocatePayouts([commission('zero', '2026-01-01', 0), commission('a', '2026-02-01', 40)], 10);
        expect(summary(result)).toEqual({ zero: ['NONE', 0], a: ['PARTIAL', 10] });
    });

    it('rounds amounts to cents', () => {
        const result = allocatePayouts([commission('a', '2026-01-01', 33.33), commission('b', '2026-01-02', 33.33)], 50);
        expect(summary(result)).toEqual({ a: ['PAID', 33.33], b: ['PARTIAL', 16.67] });
    });
});
