import prisma from '../../config/database';
import { createSalaryPayment } from './salary-payments.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        teacher: { findUnique: jest.fn() },
        user: { findUnique: jest.fn() },
    },
}));

jest.mock('../transactions/transactions.service', () => ({
    createTransaction: jest.fn().mockResolvedValue({ id: 'tx1' }),
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('throws when the TEACHER belongs to a different branch', async () => {
        (prisma.teacher.findUnique as jest.Mock).mockResolvedValue({ id: 't1', name: 'Prof A', branchId: 'other-branch' });

        await expect(
            createSalaryPayment({ personnelId: 't1', personnelType: 'TEACHER', amount: 1000, month: '2026-08', branchId: 'b1' } as any)
        ).rejects.toThrow('Teacher not found');
    });

    it('throws when the SECRETARY (User) belongs to a different branch', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1', name: 'Sec A', branchId: 'other-branch' });

        await expect(
            createSalaryPayment({ personnelId: 'u1', personnelType: 'SECRETARY', amount: 1000, month: '2026-08', branchId: 'b1' } as any)
        ).rejects.toThrow('User not found');
    });

    it('creates the salary transaction with branchId when the TEACHER matches', async () => {
        const { createTransaction } = require('../transactions/transactions.service');
        (prisma.teacher.findUnique as jest.Mock).mockResolvedValue({ id: 't1', name: 'Prof A', branchId: 'b1' });

        await createSalaryPayment({ personnelId: 't1', personnelType: 'TEACHER', amount: 1000, month: '2026-08', branchId: 'b1' } as any);

        expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'b1', type: 'EXPENSE' }));
    });
});
