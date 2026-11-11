import prisma from '../../config/database';
import {
    buildTotals,
    resolveReferralCode,
    isReferralCodeValid,
    listAgents,
    createAgent,
    updateAgent,
    getAgentReport,
    getAgentReportForUser,
    recordPayout,
    deletePayout,
} from './salesAgents.service';
import * as bcryptUtil from '../../utils/bcrypt';

jest.mock('../../config/database', () => {
    const tx = { user: { create: jest.fn(), update: jest.fn() }, salesAgent: { create: jest.fn(), update: jest.fn() } };
    return {
        __esModule: true,
        default: {
            salesAgent: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
            user: { findUnique: jest.fn() },
            pack: { findMany: jest.fn(), count: jest.fn() },
            agentPayout: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

const PACK_A = '6ab050b281878c35b0f00752';
const PACK_B = '6ab050b181878c35b0f00750';
const LEGACY = 'commissionRate is no longer accepted: send monthlyRate, semiannualRate and yearlyRate';

afterEach(() => jest.clearAllMocks());

describe('resolveReferralCode', () => {
    it('requires a code', async () => {
        await expect(resolveReferralCode(undefined)).rejects.toThrow('Referral code is required');
        await expect(resolveReferralCode('   ')).rejects.toThrow('Referral code is required');
        expect(prisma.salesAgent.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a non-string without querying', async () => {
        await expect(resolveReferralCode({ $ne: null })).rejects.toThrow('Invalid referral code');
        expect(prisma.salesAgent.findFirst).not.toHaveBeenCalled();
    });

    it('looks up an active agent by the normalised code', async () => {
        const agent = { id: 'a1', code: 'YOUSSEF22', active: true };
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(agent);

        await expect(resolveReferralCode(' youssef22 ')).resolves.toBe(agent);
        expect(prisma.salesAgent.findFirst).toHaveBeenCalledWith({ where: { code: 'YOUSSEF22', active: true } });
    });

    it('rejects an unknown or inactive code', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(resolveReferralCode('NOPE')).rejects.toThrow('Invalid referral code');
    });
});

describe('isReferralCodeValid', () => {
    it('returns true for an active code and false otherwise', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'a1' }).mockResolvedValueOnce(null);
        await expect(isReferralCodeValid('ARWA')).resolves.toBe(true);
        await expect(isReferralCodeValid('NOPE')).resolves.toBe(false);
        await expect(isReferralCodeValid('')).resolves.toBe(false);
    });

    it('surfaces infrastructure errors instead of calling the code invalid', async () => {
        (prisma.salesAgent.findFirst as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error('db down'), { name: 'PrismaClientKnownRequestError' })
        );
        await expect(isReferralCodeValid('ARWA')).rejects.toThrow('db down');
    });
});

describe('listAgents', () => {
    const stored = (packRates: unknown[]) => ({
        id: 'a1',
        name: 'Youssef',
        code: 'YOUSSEF22',
        monthlyRate: 10,
        semiannualRate: 15,
        yearlyRate: 25,
        packRates,
        isHouse: false,
        active: true,
        userId: 'u1',
        user: { email: 'y@example.com' },
        schools: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
        payments: [{ commissionAmount: 52.5 }, { commissionAmount: 30.25 }],
        payouts: [{ amount: 50 }],
    });

    it('returns agents (house first) with their rates, named pack exceptions and totals, without the user id', async () => {
        (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue([stored([{ packId: PACK_A, period: 'YEARLY', rate: 20 }])]);
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([{ id: PACK_A, name: 'Crèche', code: 'creche' }]);

        const [agent] = await listAgents();

        expect(prisma.salesAgent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: [{ isHouse: 'desc' }, { createdAt: 'asc' }] })
        );
        expect(prisma.pack.findMany).toHaveBeenCalledWith({
            where: { id: { in: [PACK_A] } },
            select: { id: true, name: true, code: true },
        });
        expect(agent).toEqual({
            id: 'a1',
            name: 'Youssef',
            code: 'YOUSSEF22',
            monthlyRate: 10,
            semiannualRate: 15,
            yearlyRate: 25,
            packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20, packName: 'Crèche', packCode: 'creche' }],
            isHouse: false,
            active: true,
            email: 'y@example.com',
            totals: { schools: 2, activeSchools: 1, totalCommissions: 82.75, totalPayouts: 50, balance: 32.75 },
        });
    });

    it('does not query packs when no agent has exceptions', async () => {
        (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue([stored([])]);

        const [agent] = await listAgents();

        expect(prisma.pack.findMany).not.toHaveBeenCalled();
        expect(agent.packRates).toEqual([]);
    });
});

describe('buildTotals', () => {
    it('gives a negative balance when payouts exceed commissions', () => {
        expect(buildTotals([{ status: 'ACTIVE' }], [{ commissionAmount: 52.5 }], [{ amount: 100 }])).toEqual({
            schools: 1,
            activeSchools: 1,
            totalCommissions: 52.5,
            totalPayouts: 100,
            balance: -47.5,
        });
    });
});

describe('createAgent', () => {
    const input = {
        name: 'Youssef',
        email: 'Y@example.com',
        password: 'secret123',
        code: 'youssef22',
        monthlyRate: 10,
        semiannualRate: 15,
        yearlyRate: 25,
    };

    beforeEach(() => {
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed');
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        tx.user.create.mockResolvedValue({ id: 'u1' });
        tx.salesAgent.create.mockResolvedValue({ id: 'a1', code: 'YOUSSEF22' });
    });
    afterEach(() => jest.restoreAllMocks());

    it('creates the SALES_AGENT user and the agent with its three rates in one transaction', async () => {
        tx.salesAgent.create.mockResolvedValue({ id: 'a1', code: 'YOUSSEF22', userId: 'u1' });
        await expect(createAgent(input)).resolves.toEqual({ id: 'a1', code: 'YOUSSEF22' });

        expect(tx.user.create).toHaveBeenCalledWith({
            data: { email: 'y@example.com', password: 'hashed', name: 'Youssef', role: 'SALES_AGENT', gsm: undefined },
        });
        expect(tx.salesAgent.create).toHaveBeenCalledWith({
            data: {
                name: 'Youssef',
                phone: undefined,
                code: 'YOUSSEF22',
                monthlyRate: 10,
                semiannualRate: 15,
                yearlyRate: 25,
                packRates: [],
                userId: 'u1',
            },
        });
        expect(prisma.pack.count).not.toHaveBeenCalled();
    });

    it('stores pack exceptions after checking that the packs exist', async () => {
        (prisma.pack.count as jest.Mock).mockResolvedValue(1);

        await createAgent({ ...input, packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] });

        expect(prisma.pack.count).toHaveBeenCalledWith({ where: { id: { in: [PACK_A] } } });
        expect(tx.salesAgent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] }),
        });
    });

    it('rejects an unknown pack before creating anything', async () => {
        (prisma.pack.count as jest.Mock).mockResolvedValue(0);
        await expect(createAgent({ ...input, packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] })).rejects.toThrow(
            'Unknown pack in pack rates'
        );
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects the v1 single rate', async () => {
        await expect(createAgent({ ...input, commissionRate: 15 })).rejects.toThrow(LEGACY);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a code already in use', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'other' });
        await expect(createAgent(input)).rejects.toThrow('This code is already used');
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an email already in use', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u0' });
        await expect(createAgent(input)).rejects.toThrow('Email already exists');
    });

    it('turns a unique-index race into a friendly message', async () => {
        (prisma.$transaction as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
        await expect(createAgent(input)).rejects.toThrow('Email or code already exists');
    });
});

describe('updateAgent', () => {
    it('updates the base rates', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'a1', monthlyRate: 12, yearlyRate: 30, userId: 'u1' });

        await expect(updateAgent('a1', { monthlyRate: 12, yearlyRate: '30' })).resolves.toEqual({
            id: 'a1',
            monthlyRate: 12,
            yearlyRate: 30,
        });

        expect(prisma.salesAgent.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { monthlyRate: 12, yearlyRate: 30 } });
    });

    it('replaces the whole pack exception list', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'a1', userId: 'u1' });
        (prisma.pack.count as jest.Mock).mockResolvedValue(2);

        await updateAgent('a1', {
            packRates: [
                { packId: PACK_A, period: 'YEARLY', rate: 20 },
                { packId: PACK_B, period: 'SEMIANNUAL', rate: '18' },
            ],
        });

        expect(prisma.pack.count).toHaveBeenCalledWith({ where: { id: { in: [PACK_A, PACK_B] } } });
        expect(prisma.salesAgent.update).toHaveBeenCalledWith({
            where: { id: 'a1' },
            data: {
                packRates: {
                    set: [
                        { packId: PACK_A, period: 'YEARLY', rate: 20 },
                        { packId: PACK_B, period: 'SEMIANNUAL', rate: 18 },
                    ],
                },
            },
        });
    });

    it('clears the exceptions with an empty list', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'a1', userId: 'u1' });

        await updateAgent('a1', { packRates: [] });

        expect(prisma.pack.count).not.toHaveBeenCalled();
        expect(prisma.salesAgent.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { packRates: { set: [] } } });
    });

    it('404s an unknown pack in the exceptions', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        (prisma.pack.count as jest.Mock).mockResolvedValue(0);

        await expect(updateAgent('a1', { packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] })).rejects.toThrow(
            'Unknown pack in pack rates'
        );
        expect(prisma.salesAgent.update).not.toHaveBeenCalled();
    });

    it('rejects the v1 single rate before reading the agent', async () => {
        await expect(updateAgent('a1', { commissionRate: 20 })).rejects.toThrow(LEGACY);
        expect(prisma.salesAgent.findUnique).not.toHaveBeenCalled();
    });

    it('refuses to deactivate the house agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', isHouse: true });
        await expect(updateAgent('h1', { active: false })).rejects.toThrow('The company code cannot be deactivated');
        expect(prisma.salesAgent.update).not.toHaveBeenCalled();
    });

    it('404s an unknown agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(updateAgent('zz', { name: 'x' })).rejects.toThrow('Sales agent not found');
    });

    it('refuses a non-zero rate or any pack exception on the house agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', isHouse: true, userId: null });

        await expect(updateAgent('h1', { semiannualRate: 5 })).rejects.toThrow('The company code earns no commission');
        await expect(updateAgent('h1', { packRates: [{ packId: PACK_A, period: 'MONTHLY', rate: 0 }] })).rejects.toThrow(
            'The company code earns no commission'
        );
        expect(prisma.salesAgent.update).not.toHaveBeenCalled();
    });

    it('accepts zero rates and no exceptions on the house agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'h1', isHouse: true, userId: null });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'h1', userId: null });

        await updateAgent('h1', { monthlyRate: 0, semiannualRate: 0, yearlyRate: 0, packRates: [] });

        expect(prisma.salesAgent.update).toHaveBeenCalledWith({
            where: { id: 'h1' },
            data: { monthlyRate: 0, semiannualRate: 0, yearlyRate: 0, packRates: { set: [] } },
        });
    });

    it('keeps the login account name and phone in sync with the agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false, userId: 'u1' });
        tx.salesAgent.update.mockResolvedValue({ id: 'a1', name: 'Ali', phone: null, userId: 'u1' });

        await expect(updateAgent('a1', { name: 'Ali', phone: '' })).resolves.toEqual({ id: 'a1', name: 'Ali', phone: null });

        expect(tx.salesAgent.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { name: 'Ali', phone: null } });
        expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { name: 'Ali', gsm: null } });
        expect(prisma.salesAgent.update).not.toHaveBeenCalled();
    });
});

describe('agent report', () => {
    const school = (id: string, name: string, status: string) => ({
        id,
        name,
        city: 'Casa',
        institutionType: 'PRIVATE_SCHOOL',
        status,
        createdAt: new Date('2026-01-15'),
        ownerName: 'Owner',
        ownerPhone: '0611',
        pack: { name: 'Pro' },
    });

    const stored = {
        id: 'a1',
        name: 'Youssef',
        phone: '0600',
        code: 'YOUSSEF22',
        monthlyRate: 10,
        semiannualRate: 15,
        yearlyRate: 25,
        packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }],
        isHouse: false,
        active: true,
        userId: 'u1',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        user: { email: 'y@example.com' },
        schools: [
            school('s1', 'Ecole A', 'ACTIVE'), // has credited payments -> CONFIRMED
            school('s2', 'Ecole B', 'PENDING'),
            school('s3', 'Ecole C', 'ACTIVE'), // no payment -> ACTIVE_UNPAID
            school('s4', 'Ecole D', 'SUSPENDED'), // paid before -> CANCELLED, its commission is still owed
        ],
        // As Prisma returns them: newest first.
        payments: [
            { id: 'p1', schoolId: 's1', paidAt: new Date('2026-03-01'), createdAt: new Date('2026-03-01'), amount: 350, period: 'MONTHLY', packName: 'Pro', commissionRate: 10, commissionAmount: 35, school: { name: 'Ecole A' } },
            { id: 'p2', schoolId: 's4', paidAt: new Date('2026-02-01'), createdAt: new Date('2026-02-01'), amount: 1500, period: 'SEMIANNUAL', packName: 'Pro', commissionRate: 15, commissionAmount: 225, school: { name: 'Ecole D' } },
            // Recorded the day after p3 for the same payment date, while the monthly rate was 0 %.
            { id: 'p4', schoolId: 's1', paidAt: new Date('2026-01-01'), createdAt: new Date('2026-01-02'), amount: 100, period: 'MONTHLY', packName: null, commissionRate: 0, commissionAmount: 0, school: { name: 'Ecole A' } },
            // A school that moved to another agent: still credited here, but not in this agent's schools.
            { id: 'p3', schoolId: 's9', paidAt: new Date('2026-01-01'), createdAt: new Date('2026-01-01'), amount: 1000, period: 'YEARLY', packName: null, commissionRate: 25, commissionAmount: 250, school: { name: 'Ecole Z' } },
        ],
        payouts: [{ id: 'o1', paidAt: new Date('2026-03-05'), amount: 300, note: null }],
    };

    beforeEach(() => {
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([{ id: PACK_A, name: 'Crèche', code: 'creche' }]);
    });

    it('builds the report for an agent id, with rates, statuses and oldest-first payout allocation', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(stored);

        const report = await getAgentReport('a1');

        expect((prisma.salesAgent.findUnique as jest.Mock).mock.calls[0][0].where).toEqual({ id: 'a1' });
        expect(report.agent).toEqual({
            id: 'a1',
            name: 'Youssef',
            phone: '0600',
            code: 'YOUSSEF22',
            monthlyRate: 10,
            semiannualRate: 15,
            yearlyRate: 25,
            packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20, packName: 'Crèche', packCode: 'creche' }],
            isHouse: false,
            active: true,
            email: 'y@example.com',
            referralPath: '/signup?ref=YOUSSEF22',
        });
        expect(report.totals).toEqual({
            schools: 4,
            activeSchools: 2,
            totalCommissions: 510,
            totalPayouts: 300,
            balance: 210,
            statusCounts: { PENDING: 1, ACTIVE_UNPAID: 1, CONFIRMED: 1, CANCELLED: 1 },
        });
        expect(report.schools[0]).toEqual({
            id: 's1',
            name: 'Ecole A',
            city: 'Casa',
            institutionType: 'PRIVATE_SCHOOL',
            status: 'ACTIVE',
            createdAt: new Date('2026-01-15'),
            ownerName: 'Owner',
            ownerPhone: '0611',
            packName: 'Pro',
            clientStatus: 'CONFIRMED',
            totalPaid: 450,
            firstPaidAt: new Date('2026-01-01'),
            lastPaidAt: new Date('2026-03-01'),
            lastPeriod: 'MONTHLY',
            paymentsCount: 2,
        });
        expect(report.schools.map((s) => [s.id, s.firstPaidAt, s.lastPaidAt, s.lastPeriod, s.paymentsCount])).toEqual([
            ['s1', new Date('2026-01-01'), new Date('2026-03-01'), 'MONTHLY', 2],
            ['s2', null, null, null, 0],
            ['s3', null, null, null, 0],
            ['s4', new Date('2026-02-01'), new Date('2026-02-01'), 'SEMIANNUAL', 1],
        ]);
        expect(report.schools.map((s) => [s.id, s.status, s.clientStatus, s.totalPaid])).toEqual([
            ['s1', 'ACTIVE', 'CONFIRMED', 450],
            ['s2', 'PENDING', 'PENDING', 0],
            ['s3', 'ACTIVE', 'ACTIVE_UNPAID', 0],
            ['s4', 'SUSPENDED', 'CANCELLED', 1500],
        ]);
        // 300 paid out: p3 (oldest, 250) is paid, p4 has no commission, p2 gets the last 50, p1 is due.
        expect(report.commissions).toEqual([
            { id: 'p1', paidAt: new Date('2026-03-01'), amount: 350, period: 'MONTHLY', packName: 'Pro', commissionRate: 10, commissionAmount: 35, schoolName: 'Ecole A', payoutStatus: 'DUE', paidAmount: 0 },
            { id: 'p2', paidAt: new Date('2026-02-01'), amount: 1500, period: 'SEMIANNUAL', packName: 'Pro', commissionRate: 15, commissionAmount: 225, schoolName: 'Ecole D', payoutStatus: 'PARTIAL', paidAmount: 50 },
            { id: 'p4', paidAt: new Date('2026-01-01'), amount: 100, period: 'MONTHLY', packName: null, commissionRate: 0, commissionAmount: 0, schoolName: 'Ecole A', payoutStatus: 'NONE', paidAmount: 0 },
            { id: 'p3', paidAt: new Date('2026-01-01'), amount: 1000, period: 'YEARLY', packName: null, commissionRate: 25, commissionAmount: 250, schoolName: 'Ecole Z', payoutStatus: 'PAID', paidAmount: 250 },
        ]);
        expect(report.payouts).toEqual(stored.payouts);
    });

    it('scopes the agent space by the logged-in user id, and commissions by the payment agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(stored);

        await getAgentReportForUser('u1');

        const args = (prisma.salesAgent.findUnique as jest.Mock).mock.calls[0][0];
        expect(args.where).toEqual({ userId: 'u1' });
        // Commissions come from the agent's own `payments` relation (SchoolPayment.salesAgentId),
        // so a payment made before the school moved to another agent stays with this agent.
        expect(args.include.payments.select).toEqual(
            expect.objectContaining({ commissionAmount: true, schoolId: true, createdAt: true, packName: true })
        );
        expect(args.include.payments.orderBy).toEqual([{ paidAt: 'desc' }, { createdAt: 'desc' }]);
        expect(args.include.schools.select.payments).toBeUndefined();
    });

    it('does not query packs for an agent without exceptions', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ ...stored, packRates: [] });

        const report = await getAgentReport('a1');

        expect(prisma.pack.findMany).not.toHaveBeenCalled();
        expect(report.agent.packRates).toEqual([]);
    });

    it('404s when no agent matches', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getAgentReportForUser('u9')).rejects.toThrow('Sales agent not found');
    });
});

describe('payouts', () => {
    it('records a payout for an existing agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1' });
        (prisma.agentPayout.create as jest.Mock).mockResolvedValue({ id: 'o1' });

        await recordPayout('a1', { amount: 3000, paidAt: '2026-11-10', note: 'virement' });

        expect(prisma.agentPayout.create).toHaveBeenCalledWith({
            data: { amount: 3000, paidAt: new Date('2026-11-10'), note: 'virement', salesAgentId: 'a1' },
        });
    });

    it('404s a payout for an unknown agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(recordPayout('zz', { amount: 10, paidAt: '2026-11-10' })).rejects.toThrow('Sales agent not found');
    });

    it('deletes only a payout that belongs to the agent', async () => {
        (prisma.agentPayout.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'o1' }).mockResolvedValueOnce(null);

        await expect(deletePayout('a1', 'o1')).resolves.toEqual({ id: 'o1' });
        expect(prisma.agentPayout.findFirst).toHaveBeenCalledWith({ where: { id: 'o1', salesAgentId: 'a1' } });
        expect(prisma.agentPayout.delete).toHaveBeenCalledWith({ where: { id: 'o1' } });

        await expect(deletePayout('a2', 'o1')).rejects.toThrow('Payout not found');
    });
});
