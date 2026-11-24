// src/modules/school-mode/dues.service.test.ts
import prisma from '../../config/database';
import { createTransaction } from '../transactions/transactions.service';
import { collectMonth, listDues } from './dues.service';

jest.mock('../transactions/transactions.service', () => ({ createTransaction: jest.fn() }));
jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { student: { findMany: jest.fn(), findFirst: jest.fn() }, payment: { findMany: jest.fn(), create: jest.fn() } },
}));
const db = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('listDues', () => {
    it('gives each student paid / partial / unpaid for the month', async () => {
        db.student.findMany.mockResolvedValue([
            { id: 's1', name: 'Lina', surname: 'Sqalli', schoolLevel: 'PS2', monthlyFee: 600, parentPhone: '0612345678', groupIds: [] },
            { id: 's2', name: 'Adam', surname: 'Bennani', schoolLevel: 'P3', monthlyFee: 800, parentPhone: null, groupIds: [] },
            { id: 's3', name: 'Rim', surname: 'Tazi', schoolLevel: 'P3', monthlyFee: 800, parentPhone: null, groupIds: [] },
        ]);
        db.payment.findMany.mockResolvedValue([
            { studentId: 's1', amount: 600 },
            { studentId: 's2', amount: 300 },
        ]);
        const result = await listDues('b1', '2026-11');
        expect(db.student.findMany.mock.calls[0][0].where).toMatchObject({ branchId: 'b1', active: true, monthlyFee: { gt: 0 } });
        expect(result.rows.map((r) => [r.studentId, r.paid, r.status])).toEqual([
            ['s1', 600, 'PAID'],
            ['s2', 300, 'PARTIAL'],
            ['s3', 0, 'UNPAID'],
        ]);
        expect(result.totals).toEqual({ expected: 2200, collected: 900, remaining: 1300 });
    });

    it('has nothing due in July and August', async () => {
        expect(await listDues('b1', '2027-07')).toEqual({ month: '2027-07', rows: [], totals: { expected: 0, collected: 0, remaining: 0 } });
        expect(db.student.findMany).not.toHaveBeenCalled();
    });
});

describe('collectMonth', () => {
    it('records the payment for the month and the income', async () => {
        db.student.findFirst.mockResolvedValue({ id: 's1', name: 'Lina', surname: 'Sqalli', monthlyFee: 600 });
        db.payment.findMany.mockResolvedValue([{ amount: 200 }]);
        db.payment.create.mockImplementation(({ data }: any) => ({ id: 'p1', ...data }));
        await collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 400, method: 'CASH' });
        expect(db.payment.create.mock.calls[0][0].data).toMatchObject({ studentId: 's1', branchId: 'b1', amount: 400, forMonth: '2026-11', method: 'CASH' });
        expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ type: 'INCOME', amount: 400 }));
    });

    it('refuses more than what is left for the month', async () => {
        db.student.findFirst.mockResolvedValue({ id: 's1', name: 'Lina', surname: 'Sqalli', monthlyFee: 600 });
        db.payment.findMany.mockResolvedValue([{ amount: 600 }]);
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 100, method: 'CASH' })).rejects.toThrow('déjà payé');
        db.payment.findMany.mockResolvedValue([{ amount: 500 }]);
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 200, method: 'CASH' })).rejects.toThrow('100');
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-13', amount: 1, method: 'CASH' })).rejects.toThrow('mois');
        expect(db.payment.create).not.toHaveBeenCalled();
    });
});
