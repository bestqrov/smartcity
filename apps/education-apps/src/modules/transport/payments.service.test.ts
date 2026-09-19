import prisma from '../../config/database';
import { recordTransportPayment, getDues } from './payments.service';

jest.mock('../../config/database', () => {
    const tx = {
        payment: { findFirst: jest.fn(), create: jest.fn() },
        transaction: { create: jest.fn() },
    };
    return {
        __esModule: true,
        default: {
            transportSubscription: { findFirst: jest.fn(), findMany: jest.fn() },
            payment: { findMany: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

const subscription = {
    id: 'sub1',
    studentId: 's1',
    status: 'ACTIVE',
    monthlyPrice: 300,
    student: { name: 'Sara', surname: 'Alaoui' },
};

describe('recordTransportPayment', () => {
    afterEach(() => jest.clearAllMocks());

    const input = { subscriptionId: 'sub1', branchId: 'b1', forMonth: '2026-09', method: 'Espèces' };

    it('creates the payment and an INCOME transaction atomically, stamping branchId', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);
        tx.payment.findFirst.mockResolvedValue(null);
        tx.payment.create.mockResolvedValue({ id: 'p1' });

        await recordTransportPayment(input);

        expect(prisma.transportSubscription.findFirst).toHaveBeenCalledWith({
            where: { id: 'sub1', branchId: 'b1' },
            include: { student: true },
        });
        expect(tx.payment.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    studentId: 's1',
                    transportSubscriptionId: 'sub1',
                    forMonth: '2026-09',
                    amount: 300,
                    method: 'Espèces',
                    branchId: 'b1',
                }),
            })
        );
        expect(tx.transaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ type: 'INCOME', amount: 300, category: 'Transport', branchId: 'b1' }),
        });
    });

    it('uses an explicit amount over the subscription price', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);
        tx.payment.findFirst.mockResolvedValue(null);
        tx.payment.create.mockResolvedValue({ id: 'p1' });

        await recordTransportPayment({ ...input, amount: 150 });

        expect(tx.payment.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ amount: 150 }) })
        );
        expect(tx.transaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ amount: 150 }),
        });
    });

    it('rejects a duplicate payment for the same subscription and month, without writing a transaction', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);
        tx.payment.findFirst.mockResolvedValue({ id: 'existing' });

        await expect(recordTransportPayment(input)).rejects.toThrow('Payment already recorded for this month');
        expect(tx.payment.findFirst).toHaveBeenCalledWith({
            where: { transportSubscriptionId: 'sub1', forMonth: '2026-09', branchId: 'b1' },
        });
        expect(tx.payment.create).not.toHaveBeenCalled();
        expect(tx.transaction.create).not.toHaveBeenCalled();
    });

    it('throws for a subscription outside the branch', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(recordTransportPayment(input)).rejects.toThrow('Subscription not found');
    });

    it('rejects an ended subscription', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ ...subscription, status: 'ENDED' });

        await expect(recordTransportPayment(input)).rejects.toThrow('Subscription has ended');
    });

    it('rejects a malformed month', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);

        await expect(recordTransportPayment({ ...input, forMonth: '09/2026' })).rejects.toThrow(
            'forMonth must be in YYYY-MM format'
        );
    });

    it('rejects a non-positive amount', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);

        await expect(recordTransportPayment({ ...input, amount: 0 })).rejects.toThrow('Amount must be greater than 0');
    });

    it('rejects a NaN amount', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);

        await expect(recordTransportPayment({ ...input, amount: NaN })).rejects.toThrow('Amount must be greater than 0');
    });

    it('requires a payment method', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(subscription);

        await expect(recordTransportPayment({ ...input, method: ' ' })).rejects.toThrow('Method is required');
    });
});

describe('getDues', () => {
    afterEach(() => jest.clearAllMocks());

    it('returns ACTIVE subscriptions started by the month that have no payment for it', async () => {
        (prisma.transportSubscription.findMany as jest.Mock).mockResolvedValue([{ id: 'sub1' }, { id: 'sub2' }]);
        (prisma.payment.findMany as jest.Mock).mockResolvedValue([{ transportSubscriptionId: 'sub1' }]);

        const dues = await getDues('b1', '2026-09');

        expect(prisma.transportSubscription.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { branchId: 'b1', status: 'ACTIVE', startDate: { lt: new Date(2026, 9, 1) } },
            })
        );
        expect(prisma.payment.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1', forMonth: '2026-09', transportSubscriptionId: { in: ['sub1', 'sub2'] } },
            select: { transportSubscriptionId: true },
        });
        expect(dues).toEqual([{ id: 'sub2' }]);
    });

    it('rejects a malformed month', async () => {
        await expect(getDues('b1', 'nope')).rejects.toThrow('month must be in YYYY-MM format');
    });
});
