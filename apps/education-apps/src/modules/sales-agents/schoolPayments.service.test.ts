import prisma from '../../config/database';
import {
    assignSchoolAgent,
    listSchoolPayments,
    recordSchoolPayment,
    deleteSchoolPayment,
} from './schoolPayments.service';

jest.mock('../../config/database', () => {
    const tx = { school: { findUnique: jest.fn(), update: jest.fn() }, schoolPayment: { create: jest.fn() } };
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

const PACK_A = '6ab050b281878c35b0f00752';

const agent = {
    id: 'a1',
    active: true,
    monthlyRate: 10,
    semiannualRate: 15,
    yearlyRate: 25,
    packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }],
};

const crecheSchool = { id: 's1', packId: PACK_A, pack: { id: PACK_A, name: 'Crèche' }, salesAgent: agent };

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
    it('activates a PENDING school on its payment, and leaves ACTIVE or SUSPENDED schools alone', async () => {
        tx.school.update.mockClear();
        tx.school.findUnique.mockResolvedValueOnce({ id: 's1', status: 'PENDING', salesAgent: null, pack: null });
        await recordSchoolPayment('s1', { amount: 350, period: 'MONTHLY', paidAt: '2026-11-01' });
        expect(tx.school.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'ACTIVE' } });

        tx.school.update.mockClear();
        for (const status of ['ACTIVE', 'SUSPENDED']) {
            tx.school.findUnique.mockResolvedValueOnce({ id: 's1', status, salesAgent: null, pack: null });
            await recordSchoolPayment('s1', { amount: 350, period: 'MONTHLY', paidAt: '2026-11-01' });
        }
        expect(tx.school.update).not.toHaveBeenCalled();
    });

    beforeEach(() => tx.schoolPayment.create.mockResolvedValue({ id: 'p1' }));

    it("freezes the agent, the resolved exception rate and the school's pack on the payment", async () => {
        tx.school.findUnique.mockResolvedValue(crecheSchool);

        await recordSchoolPayment('s1', { amount: 1500, period: 'YEARLY', paidAt: '2026-11-01' });

        expect(tx.school.findUnique).toHaveBeenCalledWith({
            where: { id: 's1' },
            include: { salesAgent: true, pack: { select: { id: true, name: true } } },
        });
        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: {
                amount: 1500,
                period: 'YEARLY',
                paidAt: new Date('2026-11-01'),
                note: undefined,
                schoolId: 's1',
                salesAgentId: 'a1',
                packId: PACK_A,
                packName: 'Crèche',
                commissionRate: 20,
                commissionAmount: 300,
            },
        });
    });

    it('uses the base rate of the period when the pack has no exception for it', async () => {
        tx.school.findUnique.mockResolvedValue(crecheSchool);

        await recordSchoolPayment('s1', { amount: 150, period: 'MONTHLY', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ period: 'MONTHLY', commissionRate: 10, commissionAmount: 15, packName: 'Crèche' }),
        });
    });

    it('accepts a semi-annual payment', async () => {
        tx.school.findUnique.mockResolvedValue(crecheSchool);

        await recordSchoolPayment('s1', { amount: 1500, period: 'SEMIANNUAL', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ period: 'SEMIANNUAL', commissionRate: 15, commissionAmount: 225 }),
        });
    });

    it('uses the base rate and stores no pack for a school without a pack', async () => {
        tx.school.findUnique.mockResolvedValue({ id: 's1', packId: null, pack: null, salesAgent: agent });

        await recordSchoolPayment('s1', { amount: 1000, period: 'YEARLY', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ packId: null, packName: null, commissionRate: 25, commissionAmount: 250 }),
        });
    });

    it('an inactive agent still earns', async () => {
        tx.school.findUnique.mockResolvedValue({ ...crecheSchool, salesAgent: { ...agent, active: false } });

        await recordSchoolPayment('s1', { amount: 150, period: 'MONTHLY', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ salesAgentId: 'a1', commissionAmount: 15 }),
        });
    });

    it('records a zero commission when the school has no agent, but still snapshots the pack', async () => {
        tx.school.findUnique.mockResolvedValue({ ...crecheSchool, salesAgent: null });

        await recordSchoolPayment('s1', { amount: 350, period: 'MONTHLY', paidAt: '2026-11-01' });

        expect(tx.schoolPayment.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ salesAgentId: null, commissionRate: 0, commissionAmount: 0, packId: PACK_A, packName: 'Crèche' }),
        });
    });

    it('404s an unknown school and validates input before touching the database', async () => {
        tx.school.findUnique.mockResolvedValue(null);
        await expect(recordSchoolPayment('zz', { amount: 350, period: 'MONTHLY', paidAt: '2026-11-01' })).rejects.toThrow('School not found');

        jest.clearAllMocks();
        await expect(recordSchoolPayment('s1', { amount: 0, period: 'MONTHLY', paidAt: '2026-11-01' })).rejects.toThrow(
            'Amount must be greater than 0'
        );
        await expect(recordSchoolPayment('s1', { amount: 10, period: 'WEEKLY', paidAt: '2026-11-01' })).rejects.toThrow(
            'Period must be MONTHLY, SEMIANNUAL or YEARLY'
        );
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
