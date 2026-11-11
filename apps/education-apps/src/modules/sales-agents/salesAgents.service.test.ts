import prisma from '../../config/database';
import { resolveReferralCode, isReferralCodeValid, listAgents, createAgent, updateAgent } from './salesAgents.service';
import * as bcryptUtil from '../../utils/bcrypt';

jest.mock('../../config/database', () => {
    const tx = { user: { create: jest.fn() }, salesAgent: { create: jest.fn() } };
    return {
        __esModule: true,
        default: {
            salesAgent: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
            user: { findUnique: jest.fn() },
            agentPayout: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

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
});

describe('listAgents', () => {
    it('returns agents (house first) with totals and without the user id', async () => {
        (prisma.salesAgent.findMany as jest.Mock).mockResolvedValue([
            {
                id: 'a1',
                name: 'Youssef',
                code: 'YOUSSEF22',
                commissionRate: 15,
                isHouse: false,
                active: true,
                userId: 'u1',
                user: { email: 'y@example.com' },
                schools: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
                payments: [{ commissionAmount: 52.5 }, { commissionAmount: 30.25 }],
                payouts: [{ amount: 50 }],
            },
        ]);

        const [agent] = await listAgents();

        expect(prisma.salesAgent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: [{ isHouse: 'desc' }, { createdAt: 'asc' }] })
        );
        expect(agent).toEqual({
            id: 'a1',
            name: 'Youssef',
            code: 'YOUSSEF22',
            commissionRate: 15,
            isHouse: false,
            active: true,
            email: 'y@example.com',
            totals: { schools: 2, activeSchools: 1, totalCommissions: 82.75, totalPayouts: 50, balance: 32.75 },
        });
    });
});

describe('createAgent', () => {
    const input = { name: 'Youssef', email: 'Y@example.com', password: 'secret123', code: 'youssef22', commissionRate: 15 };

    beforeEach(() => {
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed');
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        tx.user.create.mockResolvedValue({ id: 'u1' });
        tx.salesAgent.create.mockResolvedValue({ id: 'a1', code: 'YOUSSEF22' });
    });
    afterEach(() => jest.restoreAllMocks());

    it('creates the SALES_AGENT user and the agent in one transaction', async () => {
        await expect(createAgent(input)).resolves.toEqual({ id: 'a1', code: 'YOUSSEF22' });

        expect(tx.user.create).toHaveBeenCalledWith({
            data: { email: 'y@example.com', password: 'hashed', name: 'Youssef', role: 'SALES_AGENT', gsm: undefined },
        });
        expect(tx.salesAgent.create).toHaveBeenCalledWith({
            data: { name: 'Youssef', phone: undefined, code: 'YOUSSEF22', commissionRate: 15, userId: 'u1' },
        });
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
    it('updates editable fields', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue({ id: 'a1', isHouse: false });
        (prisma.salesAgent.update as jest.Mock).mockResolvedValue({ id: 'a1', commissionRate: 20 });

        await updateAgent('a1', { commissionRate: 20 });

        expect(prisma.salesAgent.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { commissionRate: 20 } });
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
});
