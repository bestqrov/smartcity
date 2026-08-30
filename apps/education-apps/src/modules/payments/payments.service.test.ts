import prisma from '../../config/database';
import { createPayment, getAllPayments, getPaymentById } from './payments.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        payment: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    },
}));

jest.mock('../transactions/transactions.service', () => ({
    createTransaction: jest.fn().mockResolvedValue({}),
    getMonthlyTransactionStats: jest.fn(),
}));

jest.mock('../teachers/teachers.service', () => ({
    calculateMonthlyTeacherExpenses: jest.fn(),
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createPayment throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(
            createPayment({ studentId: 's1', amount: 100, method: 'CASH', branchId: 'b1' } as any)
        ).rejects.toThrow('Student not found');
    });

    it('createPayment stamps branchId from the given value when the student matches', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1', name: 'A', surname: 'B' });
        (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });

        await createPayment({ studentId: 's1', amount: 100, method: 'CASH', branchId: 'b1' } as any);

        expect(prisma.payment.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAllPayments only returns payments in the given branch', async () => {
        (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

        await getAllPayments('b1');

        expect(prisma.payment.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('getPaymentById throws for a payment outside the given branch', async () => {
        (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(getPaymentById('p1', 'b1')).rejects.toThrow('Payment not found');
        expect(prisma.payment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', branchId: 'b1' } }));
    });
});
