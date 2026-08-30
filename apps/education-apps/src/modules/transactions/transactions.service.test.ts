import prisma from '../../config/database';
import { createTransaction, getAllTransactions, getTransactionStats, deleteTransaction } from './transactions.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        transaction: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createTransaction stamps branchId from the given value', async () => {
        (prisma.transaction.create as jest.Mock).mockResolvedValue({ id: 'tx1', branchId: 'b1' });

        await createTransaction({ type: 'INCOME', amount: 100, category: 'Test', branchId: 'b1' } as any);

        expect(prisma.transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAllTransactions only returns transactions in the given branch', async () => {
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

        await getAllTransactions('b1');

        expect(prisma.transaction.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('getTransactionStats only aggregates transactions in the given branch', async () => {
        (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
            { type: 'INCOME', amount: 100 },
            { type: 'EXPENSE', amount: 40 },
        ]);

        const result = await getTransactionStats('b1');

        expect(prisma.transaction.findMany).toHaveBeenCalledWith({ where: { branchId: 'b1' } });
        expect(result).toEqual({ totalIncome: 100, totalExpense: 40, balance: 60 });
    });

    it('deleteTransaction throws for a transaction outside the given branch', async () => {
        (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(deleteTransaction('tx1', 'b1')).rejects.toThrow('Transaction not found');
        expect(prisma.transaction.findFirst).toHaveBeenCalledWith({ where: { id: 'tx1', branchId: 'b1' } });
    });
});
