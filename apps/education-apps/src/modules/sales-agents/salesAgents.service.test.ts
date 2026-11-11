import prisma from '../../config/database';
import { resolveReferralCode, isReferralCodeValid } from './salesAgents.service';

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
