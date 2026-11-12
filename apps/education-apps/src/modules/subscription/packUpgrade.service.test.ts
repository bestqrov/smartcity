import prisma from '../../config/database';
import { getSchoolCapacity } from '../packs/packs.limits';
import { addOneMonth, getPendingUpgrades, upgradeSchoolPack } from './packUpgrade.service';

jest.mock('../packs/packs.limits', () => ({ getSchoolCapacity: jest.fn() }));

jest.mock('../../config/database', () => {
    const tx = {
        school: { findUnique: jest.fn(), update: jest.fn() },
        pack: { findFirst: jest.fn() },
        packUpgrade: { create: jest.fn() },
    };
    return {
        __esModule: true,
        default: {
            packUpgrade: { findMany: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

const ESSENTIEL = { id: 'p1', code: 'essentiel-soutien', name: 'Essentiel', maxStudents: 150, monthlyPrice: 170, active: true, institutionTypes: ['TUTORING_CENTER'] };
const PRO = { id: 'p2', code: 'pro-soutien', name: 'Pro', maxStudents: 400, monthlyPrice: 300, active: true, institutionTypes: ['TUTORING_CENTER'] };
const PREMIUM = { id: 'p3', code: 'premium-soutien', name: 'Premium', maxStudents: null, monthlyPrice: 399, active: true, institutionTypes: ['TUTORING_CENTER'] };
const SCHOOL_PRO = { id: 'sc1', status: 'ACTIVE', institutionType: 'TUTORING_CENTER', pack: PRO };

beforeEach(() => {
    jest.clearAllMocks();
    (getSchoolCapacity as jest.Mock).mockResolvedValue({ schoolId: 'sc1', current: 390, limit: 400 });
    tx.packUpgrade.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'u1', ...data }));
});

describe('addOneMonth', () => {
    it('adds one calendar month', () => {
        expect(addOneMonth(new Date('2026-11-12T10:00:00Z')).toISOString()).toBe('2026-12-12T10:00:00.000Z');
        expect(addOneMonth(new Date('2026-12-20T00:00:00Z')).toISOString()).toBe('2027-01-20T00:00:00.000Z');
    });

    it('clamps to the last day of a shorter month', () => {
        expect(addOneMonth(new Date('2027-01-31T09:00:00Z')).toISOString()).toBe('2027-02-28T09:00:00.000Z');
        expect(addOneMonth(new Date('2028-01-31T09:00:00Z')).toISOString()).toBe('2028-02-29T09:00:00.000Z');
    });
});

describe('upgradeSchoolPack', () => {
    it('moves an ACTIVE school to a bigger pack, with a deadline one month later', async () => {
        tx.school.findUnique.mockResolvedValue(SCHOOL_PRO);
        tx.pack.findFirst.mockResolvedValue(PREMIUM);

        const result = await upgradeSchoolPack('b1', 'user1', 'premium-soutien');

        expect(tx.pack.findFirst).toHaveBeenCalledWith({ where: { code: 'premium-soutien', active: true } });
        expect(tx.school.update).toHaveBeenCalledWith({ where: { id: 'sc1' }, data: { packId: 'p3' } });
        const data = tx.packUpgrade.create.mock.calls[0][0].data;
        expect(data).toMatchObject({
            schoolId: 'sc1',
            fromPackId: 'p2',
            fromPackName: 'Pro',
            toPackId: 'p3',
            toPackName: 'Premium',
            toMonthlyPrice: 399,
            byUserId: 'user1',
            reason: 'STUDENT_LIMIT',
            settledAt: null,
        });
        expect(data.dueAt).toEqual(addOneMonth(data.createdAt));
        expect(result).toEqual({ packCode: 'premium-soutien', packName: 'Premium', limit: null, current: 390, dueAt: data.dueAt });
    });

    it('sets no deadline for a school still on trial', async () => {
        tx.school.findUnique.mockResolvedValue({ ...SCHOOL_PRO, status: 'PENDING' });
        tx.pack.findFirst.mockResolvedValue(PREMIUM);
        await upgradeSchoolPack('b1', 'user1', 'premium-soutien');
        expect(tx.packUpgrade.create.mock.calls[0][0].data.dueAt).toBeNull();
    });

    it('refuses the same pack, a smaller pack, a pack of another type, and an unknown or inactive pack', async () => {
        tx.school.findUnique.mockResolvedValue(SCHOOL_PRO);

        tx.pack.findFirst.mockResolvedValueOnce(PRO);
        await expect(upgradeSchoolPack('b1', 'u', 'pro-soutien')).rejects.toThrow('Only an upgrade to a bigger pack is allowed');
        tx.pack.findFirst.mockResolvedValueOnce(ESSENTIEL);
        await expect(upgradeSchoolPack('b1', 'u', 'essentiel-soutien')).rejects.toThrow('Only an upgrade to a bigger pack is allowed');
        tx.pack.findFirst.mockResolvedValueOnce({ ...PREMIUM, institutionTypes: ['CRECHE'] });
        await expect(upgradeSchoolPack('b1', 'u', 'creche-plus')).rejects.toThrow('Pack does not serve this institution type');
        tx.pack.findFirst.mockResolvedValueOnce(null);
        await expect(upgradeSchoolPack('b1', 'u', 'nope')).rejects.toThrow('Pack not found');

        expect(tx.school.update).not.toHaveBeenCalled();
        expect(tx.packUpgrade.create).not.toHaveBeenCalled();
    });

    it('lets a school with no pack pick any pack of its type', async () => {
        tx.school.findUnique.mockResolvedValue({ ...SCHOOL_PRO, pack: null });
        tx.pack.findFirst.mockResolvedValue(ESSENTIEL);
        await expect(upgradeSchoolPack('b1', 'u', 'essentiel-soutien')).resolves.toMatchObject({ packName: 'Essentiel' });
    });

    it('requires a pack code', async () => {
        await expect(upgradeSchoolPack('b1', 'u', undefined)).rejects.toThrow('Pack code is required');
        await expect(upgradeSchoolPack('b1', 'u', { $ne: 1 })).rejects.toThrow('Pack code is required');
    });

    it("always upgrades the caller's school, found from the branch", async () => {
        tx.school.findUnique.mockResolvedValue(SCHOOL_PRO);
        tx.pack.findFirst.mockResolvedValue(PREMIUM);
        await upgradeSchoolPack('b1', 'u', 'premium-soutien');
        expect(getSchoolCapacity).toHaveBeenCalledWith('b1');
        expect(tx.school.findUnique).toHaveBeenCalledWith({ where: { id: 'sc1' }, include: { pack: true } });
    });
});

describe('getPendingUpgrades', () => {
    it("lists the school's unsettled upgrades that have a deadline", async () => {
        (prisma.packUpgrade.findMany as jest.Mock).mockResolvedValue([]);
        await getPendingUpgrades('b1');
        expect(prisma.packUpgrade.findMany).toHaveBeenCalledWith({
            where: { schoolId: 'sc1', dueAt: { not: null }, OR: [{ settledAt: null }, { settledAt: { isSet: false } }] },
            orderBy: { createdAt: 'desc' },
            select: { id: true, toPackName: true, toMonthlyPrice: true, createdAt: true, dueAt: true },
        });
    });
});
