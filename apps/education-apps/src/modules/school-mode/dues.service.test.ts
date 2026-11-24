// src/modules/school-mode/dues.service.test.ts
import prisma from '../../config/database';
import { collectMonth, duesSummary, listDues } from './dues.service';

jest.mock('../../config/database', () => {
    const db: any = {
        student: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
        payment: { findMany: jest.fn(), create: jest.fn() },
        inscription: { findMany: jest.fn() },
        transaction: { create: jest.fn() },
    };
    db.$transaction = jest.fn((cb: any) => cb(db));
    return { __esModule: true, default: db };
});
const db = prisma as any;
const SID = '6ab050b281878c35b0f00752';
const lina = { id: 's1', name: 'Lina', surname: 'Sqalli', monthlyFee: 600, active: true, tuitionStartMonth: null };

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
        expect(db.student.findMany.mock.calls[0][0].where).toMatchObject({ branchId: 'b1', monthlyFee: { gt: 0 }, OR: [{ active: true }, { id: { in: ['s1', 's2'] } }] });
        expect(result.rows.map((r) => [r.studentId, r.paid, r.status])).toEqual([
            ['s1', 600, 'PAID'],
            ['s2', 300, 'PARTIAL'],
            ['s3', 0, 'UNPAID'],
        ]);
        expect(result.totals).toEqual({ expected: 2200, collected: 900, remaining: 1300 });
    });

    it('leaves out students whose tuition starts after the month', async () => {
        db.student.findMany.mockResolvedValue([
            { id: 's1', name: 'Lina', surname: 'Sqalli', schoolLevel: 'PS2', monthlyFee: 600, parentPhone: null, groupIds: [], tuitionStartMonth: '2026-12' },
            { id: 's2', name: 'Adam', surname: 'Bennani', schoolLevel: 'P3', monthlyFee: 800, parentPhone: null, groupIds: [], tuitionStartMonth: '2026-11' },
            { id: 's3', name: 'Rim', surname: 'Tazi', schoolLevel: 'P3', monthlyFee: 800, parentPhone: null, groupIds: [], tuitionStartMonth: null },
        ]);
        db.payment.findMany.mockResolvedValue([]);
        const result = await listDues('b1', '2026-11');
        expect(result.rows.map((r) => r.studentId)).toEqual(['s2', 's3']);
        expect(result.totals.expected).toBe(1600);
    });

    it('has nothing due in July and August', async () => {
        expect(await listDues('b1', '2027-07')).toEqual({ month: '2027-07', rows: [], totals: { expected: 0, collected: 0, remaining: 0 } });
        expect(db.student.findMany).not.toHaveBeenCalled();
    });
});

describe('listDues for a past month', () => {
    it('keeps an inactive student who paid that month', async () => {
        db.payment.findMany.mockResolvedValue([{ studentId: 'gone', amount: 600 }]);
        db.student.findMany.mockResolvedValue([{ id: 'gone', name: 'Old', surname: 'Kid', schoolLevel: 'P1', monthlyFee: 600, parentPhone: null, groupIds: [], tuitionStartMonth: null }]);
        const result = await listDues('b1', '2026-10');
        expect(db.student.findMany.mock.calls[0][0].where.OR).toEqual([{ active: true }, { id: { in: ['gone'] } }]);
        expect(result.rows[0]).toMatchObject({ studentId: 'gone', paid: 600, status: 'PAID' });
    });
});

describe('duesSummary', () => {
    const NOW = new Date('2026-11-24T10:00:00Z');
    it('adds unpaid months since the year start and unpaid inscription balances', async () => {
        db.student.findMany.mockResolvedValue([
            { id: 's1', monthlyFee: 600, tuitionStartMonth: '2025-09' }, // old start: counted from 2026-09
            { id: 's2', monthlyFee: 800, tuitionStartMonth: '2026-11' },
        ]);
        db.payment.findMany.mockResolvedValue([
            { studentId: 's1', amount: 600, forMonth: '2026-09' },
            { studentId: 's1', amount: 200, forMonth: '2026-10' },
            { studentId: 's1', amount: 600, forMonth: '2026-06' }, // previous year: ignored
            { studentId: 's2', amount: 300, forMonth: null }, // fees paid
        ]);
        db.inscription.findMany.mockResolvedValue([{ studentId: 's2', amount: 650 }, { studentId: 's1', amount: 500 }]);
        const result = await duesSummary('b1', NOW);
        // s1: oct 400 + nov 600 ; s2: nov 800 ; fees: s1 500 + s2 350
        expect(result).toEqual({ unpaid: 2650, months: 1800, inscriptions: 850 });
    });

    it('counts nothing in the summer for July/August', async () => {
        db.student.findMany.mockResolvedValue([{ id: 's1', monthlyFee: 600, tuitionStartMonth: '2026-06' }]);
        db.payment.findMany.mockResolvedValue([{ studentId: 's1', amount: 600, forMonth: '2026-06' }]);
        db.inscription.findMany.mockResolvedValue([]);
        // 2026-08-15 is still the 2025/2026 school year: Sept 2025–June 2026, June paid
        expect(await duesSummary('b1', new Date('2026-08-15T10:00:00Z'))).toEqual({ unpaid: 0, months: 0, inscriptions: 0 });
    });

    it('returns zero without school-mode students', async () => {
        db.student.findMany.mockResolvedValue([]);
        expect(await duesSummary('b1')).toEqual({ unpaid: 0, months: 0, inscriptions: 0 });
    });
});

describe('collectMonth', () => {
    it('records the payment for the month and the income', async () => {
        db.student.findFirst.mockResolvedValue(lina);
        db.payment.findMany.mockResolvedValue([{ amount: 200 }]);
        db.payment.create.mockImplementation(({ data }: any) => ({ id: 'p1', ...data }));
        await collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 400, method: 'CASH' });
        expect(db.payment.create.mock.calls[0][0].data).toMatchObject({ studentId: 's1', branchId: 'b1', amount: 400, forMonth: '2026-11', method: 'CASH' });
        expect(db.transaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'INCOME', amount: 400, branchId: 'b1' }) });
        // check + write inside one transaction that also touches the student row
        expect(db.$transaction).toHaveBeenCalledTimes(1);
        expect(db.student.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1' } }));
        expect(db.student.update.mock.invocationCallOrder[0]).toBeLessThan(db.payment.findMany.mock.invocationCallOrder[0]);
    });

    it('refuses more than what is left for the month', async () => {
        db.student.findFirst.mockResolvedValue(lina);
        db.payment.findMany.mockResolvedValue([{ amount: 600 }]);
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 100, method: 'CASH' })).rejects.toThrow('déjà payé');
        db.payment.findMany.mockResolvedValue([{ amount: 500 }]);
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-11', amount: 200, method: 'CASH' })).rejects.toThrow('100');
        await expect(collectMonth('b1', { studentId: '6ab050b281878c35b0f00752', forMonth: '2026-13', amount: 1, method: 'CASH' })).rejects.toThrow('mois');
        expect(db.payment.create).not.toHaveBeenCalled();
    });

    it('refuses a month before the tuition start, inactive students, no fee and a bad method', async () => {
        const call = (over: any = {}) => collectMonth('b1', { studentId: SID, forMonth: '2026-11', amount: 100, method: 'CASH', ...over });
        db.student.findFirst.mockResolvedValue({ ...lina, tuitionStartMonth: '2026-12' });
        await expect(call()).rejects.toThrow('commence en 2026-12');
        db.student.findFirst.mockResolvedValue({ ...lina, active: false });
        await expect(call()).rejects.toThrow('inactif');
        db.student.findFirst.mockResolvedValue({ ...lina, monthlyFee: 0 });
        await expect(call()).rejects.toThrow('Aucune mensualité');
        db.student.findFirst.mockResolvedValue({ ...lina, monthlyFee: null });
        await expect(call()).rejects.toThrow('Aucune mensualité');
        await expect(call({ method: 'BITCOIN' })).rejects.toThrow('Mode de paiement');
        expect(db.payment.create).not.toHaveBeenCalled();
        expect(db.$transaction).not.toHaveBeenCalled();
    });
});
