import prisma from '../../config/database';
import {
    assignSchoolAgent,
    listSchoolPayments,
    recordSchoolPayment,
    deleteSchoolPayment,
} from './schoolPayments.service';

jest.mock('../../config/database', () => {
    const tx = { school: { findUnique: jest.fn() }, schoolPayment: { create: jest.fn() } };
    return {
        __esModule: true,
        default: {
            school: { findUnique: jest.fn(), update: jest.fn() },
            salesAgent: { findUnique: jest.fn() },
            schoolPayment: { findMany: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

afterEach(() => jest.clearAllMocks());

describe('assignSchoolAgent', () => {
    it('sets the agent of a school', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1' });

        await assignSchoolAgent('s1', 'a1');

        expect(prisma.school.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { salesAgentId: 'a1' },
            select: { id: true, salesAgentId: true },
        });
    });

    it('clears the agent with null', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
        await assignSchoolAgent('s1', null);
        expect(prisma.salesAgent.findUnique).not.toHaveBeenCalled();
        expect(prisma.school.update).toHaveBeenCalledWith(expect.objectContaining({ data: { salesAgentId: null } }));
    });

    it('404s an unknown school or agent', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValueOnce(null);
        await expect(assignSchoolAgent('zz', 'a1')).rejects.toThrow('School not found');

        (prisma.school.findUnique as jest.Mock).mockResolvedValueOnce({ id: 's1' });
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValueOnce(null);
        await expect(assignSchoolAgent('s1', 'zz')).rejects.toThrow('Sales agent not found');
        expect(prisma.school.update).not.toHaveBeenCalled();
    });
});

describe('recordSchoolPayment', () => {
    const input = { amount: 350, period: 'MONTHLY', paidAt: '2026-11-01' };

    it("freezes the school's current agent and rate on the payment", async () => {
        tx.school.findUnique.mockResolvedValue({ id: 's1', salesAgent: { id: 'a1', commissionRate: 15 } });
        tx.schoolPayment.create.mockResolvedValue({ id: 'p1' });

        await recordSchoolPayment('s1', input);

        expect(tx.school.findUnique).toHaveBeenCalledWith({ where: { id: 's1' }, include: { salesAgent: true } });
        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: {
                amount: 350,
                period: 'MONTHLY',
                paidAt: new Date('2026-11-01'),
                note: undefined,
                schoolId: 's1',
                salesAgentId: 'a1',
                commissionRate: 15,
                commissionAmount: 52.5,
            },
        });
    });

    it('an inactive agent still earns', async () => {
        tx.school.findUnique.mockResolvedValue({ id: 's1', salesAgent: { id: 'a1', commissionRate: 15, active: false } });
        await recordSchoolPayment('s1', input);
        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ salesAgentId: 'a1', commissionAmount: 52.5 }),
        });
    });

    it('records a zero commission when the school has no agent', async () => {
        tx.school.findUnique.mockResolvedValue({ id: 's1', salesAgent: null });

        await recordSchoolPayment('s1', input);

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ salesAgentId: null, commissionRate: 0, commissionAmount: 0 }),
        });
    });

    it('404s an unknown school and validates input before touching the database', async () => {
        tx.school.findUnique.mockResolvedValue(null);
        await expect(recordSchoolPayment('zz', input)).rejects.toThrow('School not found');

        jest.clearAllMocks();
        await expect(recordSchoolPayment('s1', { ...input, amount: 0 })).rejects.toThrow('Amount must be greater than 0');
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(tx.schoolPayment.create).not.toHaveBeenCalled();
    });
});

describe('listSchoolPayments', () => {
    it("lists the school's payments, newest first, with the credited agent", async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1' });
        (prisma.schoolPayment.findMany as jest.Mock).mockResolvedValue([]);

        await listSchoolPayments('s1');

        expect(prisma.schoolPayment.findMany).toHaveBeenCalledWith({
            where: { schoolId: 's1' },
            orderBy: { paidAt: 'desc' },
            include: { salesAgent: { select: { id: true, name: true, code: true } } },
        });
    });

    it('404s an unknown school', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(listSchoolPayments('zz')).rejects.toThrow('School not found');
    });
});

describe('deleteSchoolPayment', () => {
    it('deletes only a payment of that school', async () => {
        (prisma.schoolPayment.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'p1' }).mockResolvedValueOnce(null);

        await expect(deleteSchoolPayment('s1', 'p1')).resolves.toEqual({ id: 'p1' });
        expect(prisma.schoolPayment.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', schoolId: 's1' } });
        expect(prisma.schoolPayment.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });

        await expect(deleteSchoolPayment('s2', 'p1')).rejects.toThrow('Payment not found');
    });
});
