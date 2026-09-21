import prisma from '../../config/database';
import { listPublicPacks, listAllPacks, createPack, updatePack, setDefaultPack } from './packs.service';

jest.mock('../../config/database', () => {
    const tx = { pack: { updateMany: jest.fn(), update: jest.fn() } };
    return {
        __esModule: true,
        default: {
            pack: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
            $transaction: jest.fn((cb: any) => cb(tx)),
            __tx: tx,
        },
    };
});

const tx = (prisma as any).__tx;

const stored = {
    id: 'p1',
    name: 'Pro',
    code: 'pro',
    monthlyPrice: 400,
    yearlyPrice: 4000,
    maxStudents: 300,
    maxBranches: 2,
    features: ['PARENT_PORTAL'],
    institutionTypes: ['PRIVATE_SCHOOL'],
    isDefault: true,
    active: true,
    sortOrder: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
};

describe('listPublicPacks', () => {
    afterEach(() => jest.resetAllMocks());

    it('returns only active packs ordered by sortOrder, exposing public fields and `recommended`', async () => {
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([stored]);

        const result = await listPublicPacks();

        expect(prisma.pack.findMany).toHaveBeenCalledWith({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
        expect(result).toEqual([
            {
                code: 'pro',
                name: 'Pro',
                monthlyPrice: 400,
                yearlyPrice: 4000,
                maxStudents: 300,
                maxBranches: 2,
                features: ['PARENT_PORTAL'],
                institutionTypes: ['PRIVATE_SCHOOL'],
                recommended: true,
            },
        ]);
    });

    it('filters by institution type when given', async () => {
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([]);

        await listPublicPacks('CRECHE');

        expect(prisma.pack.findMany).toHaveBeenCalledWith({
            where: { active: true, institutionTypes: { has: 'CRECHE' } },
            orderBy: { sortOrder: 'asc' },
        });
    });

    it('rejects an invalid institution type', async () => {
        await expect(listPublicPacks('UNIVERSITY')).rejects.toThrow('Invalid institution type');
        expect(prisma.pack.findMany).not.toHaveBeenCalled();
    });
});

describe('listAllPacks', () => {
    afterEach(() => jest.resetAllMocks());

    it('returns every pack with its school count', async () => {
        (prisma.pack.findMany as jest.Mock).mockResolvedValue([]);

        await listAllPacks();

        expect(prisma.pack.findMany).toHaveBeenCalledWith({
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { schools: true } } },
        });
    });
});

describe('createPack', () => {
    afterEach(() => jest.resetAllMocks());

    const input = {
        name: 'Crèche',
        code: 'creche',
        monthlyPrice: 200,
        yearlyPrice: 2000,
        maxStudents: 40,
        maxBranches: 1,
        features: ['PARENT_PORTAL', 'DAILY_LOG'],
        institutionTypes: ['CRECHE'],
    };

    it('creates a non-default pack with defaults for active and sortOrder', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.pack.create as jest.Mock).mockResolvedValue({ id: 'p9' });

        await createPack(input);

        expect(prisma.pack.findUnique).toHaveBeenCalledWith({ where: { code: 'creche' } });
        expect(prisma.pack.create).toHaveBeenCalledWith({
            data: { ...input, isDefault: false, active: true, sortOrder: 0 },
        });
    });

    it('rejects a duplicate code', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(createPack(input)).rejects.toThrow('A pack with this code already exists');
        expect(prisma.pack.create).not.toHaveBeenCalled();
    });

    it('rejects invalid input before touching the database', async () => {
        await expect(createPack({ ...input, monthlyPrice: -1 })).rejects.toThrow('monthlyPrice must be');
        expect(prisma.pack.findUnique).not.toHaveBeenCalled();
    });
});

describe('updatePack', () => {
    afterEach(() => jest.resetAllMocks());

    it('throws for an unknown pack and requires an id', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(updatePack('p1', { name: 'X' })).rejects.toThrow('Pack not found');
        await expect(updatePack('', { name: 'X' })).rejects.toThrow('Pack id is required');
    });

    it('updates only the provided fields', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue(stored);
        (prisma.pack.update as jest.Mock).mockResolvedValue(stored);

        await updatePack('p1', { monthlyPrice: 450 });

        expect(prisma.pack.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { monthlyPrice: 450 } });
    });

    it('rejects a code that another pack already uses', async () => {
        (prisma.pack.findUnique as jest.Mock)
            .mockResolvedValueOnce(stored)
            .mockResolvedValueOnce({ id: 'other', code: 'premium' });

        await expect(updatePack('p1', { code: 'premium' })).rejects.toThrow('A pack with this code already exists');
        expect(prisma.pack.update).not.toHaveBeenCalled();
    });

    it('refuses to deactivate the default pack', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ ...stored, isDefault: true });

        await expect(updatePack('p1', { active: false })).rejects.toThrow(
            'The default pack cannot be deactivated; choose another default first'
        );
        expect(prisma.pack.update).not.toHaveBeenCalled();
    });

    it('allows deactivating a non-default pack', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ ...stored, isDefault: false });
        (prisma.pack.update as jest.Mock).mockResolvedValue(stored);

        await updatePack('p1', { active: false });

        expect(prisma.pack.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { active: false } });
    });
});

describe('setDefaultPack', () => {
    afterEach(() => jest.resetAllMocks());

    it('throws for an unknown pack', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(setDefaultPack('p1')).rejects.toThrow('Pack not found');
    });

    it('refuses an inactive pack', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ ...stored, active: false });

        await expect(setDefaultPack('p1')).rejects.toThrow('An inactive pack cannot be the default');
    });

    it('clears the previous default and sets the new one in one transaction', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({ ...stored, isDefault: false });
        tx.pack.update.mockResolvedValue({ ...stored, isDefault: true });
        // resetAllMocks (afterEach of earlier tests) clears the factory implementation.
        (prisma.$transaction as jest.Mock).mockImplementation((cb: any) => cb(tx));

        const result = await setDefaultPack('p1');

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(tx.pack.updateMany).toHaveBeenCalledWith({
            where: { isDefault: true, id: { not: 'p1' }, institutionTypes: { hasSome: ['PRIVATE_SCHOOL'] } },
            data: { isDefault: false },
        });
        expect(tx.pack.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isDefault: true } });
        expect(result).toEqual(expect.objectContaining({ isDefault: true }));
    });

    it('only clears defaults of packs that share a type with the new default', async () => {
        (prisma.pack.findUnique as jest.Mock).mockResolvedValue({
            ...stored,
            id: 'p2',
            institutionTypes: ['TUTORING_CENTER', 'LANGUAGE_CENTER'],
            isDefault: false,
        });
        (prisma.$transaction as jest.Mock).mockImplementation((cb: any) => cb(tx));
        tx.pack.update.mockResolvedValue({});

        await setDefaultPack('p2');

        expect(tx.pack.updateMany).toHaveBeenCalledWith({
            where: {
                isDefault: true,
                id: { not: 'p2' },
                institutionTypes: { hasSome: ['TUTORING_CENTER', 'LANGUAGE_CENTER'] },
            },
            data: { isDefault: false },
        });
    });
});
