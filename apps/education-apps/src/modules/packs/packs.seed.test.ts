import { DEFAULT_PACKS, seedPacks } from './packs.seed';

const makeClient = (defaultExists: boolean, defaultPackId = 'pro-id') => ({
    pack: {
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(defaultExists ? 1 : 0),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({ id: defaultPackId }),
    },
    school: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
});

describe('DEFAULT_PACKS', () => {
    it('defines the four agreed packs with prices, limits and types', () => {
        expect(DEFAULT_PACKS.map((p) => [p.code, p.monthlyPrice, p.yearlyPrice, p.maxStudents, p.maxBranches])).toEqual([
            ['essentiel', 250, 2500, 100, 1],
            ['pro', 400, 4000, 300, 2],
            ['premium', 800, 8000, null, null],
            ['creche', 200, 2000, 40, 1],
        ]);
        expect(DEFAULT_PACKS.find((p) => p.code === 'creche')!.institutionTypes).toEqual(['CRECHE']);
        expect(DEFAULT_PACKS.find((p) => p.code === 'premium')!.features).toContain('TRANSPORT');
        expect(DEFAULT_PACKS.find((p) => p.code === 'creche')!.features).toEqual(['PARENT_PORTAL', 'DAILY_LOG']);
        expect(DEFAULT_PACKS.filter((p) => p.institutionTypes.includes('CRECHE')).map((p) => p.code)).toEqual(['creche']);
    });
});

describe('seedPacks', () => {
    it('upserts every pack by code without overwriting existing ones', async () => {
        const client = makeClient(true);

        await seedPacks(client as any);

        expect(client.pack.upsert).toHaveBeenCalledTimes(4);
        const call = client.pack.upsert.mock.calls[1][0];
        expect(call.where).toEqual({ code: 'pro' });
        expect(call.update).toEqual({});
        expect(call.create).toEqual(expect.objectContaining({ code: 'pro', isDefault: false }));
    });

    it('makes Pro the default only when no default exists', async () => {
        const noDefault = makeClient(false);
        await seedPacks(noDefault as any);
        expect(noDefault.pack.update).toHaveBeenCalledWith({ where: { code: 'pro' }, data: { isDefault: true } });

        const hasDefault = makeClient(true);
        await seedPacks(hasDefault as any);
        expect(hasDefault.pack.update).not.toHaveBeenCalled();
    });

    it('backfills institutionType and packId on schools that lack them (missing or null)', async () => {
        const client = makeClient(true, 'default-id');

        await seedPacks(client as any);

        expect(client.school.updateMany).toHaveBeenCalledWith({
            where: { OR: [{ institutionType: null }, { institutionType: { isSet: false } }] },
            data: { institutionType: 'PRIVATE_SCHOOL' },
        });
        expect(client.school.updateMany).toHaveBeenCalledWith({
            where: { OR: [{ packId: null }, { packId: { isSet: false } }], institutionType: 'PRIVATE_SCHOOL' },
            data: { packId: 'default-id' },
        });
    });

    it('skips the pack backfill when there is no default pack', async () => {
        const client = makeClient(true);
        client.pack.findFirst.mockResolvedValue(null);

        await seedPacks(client as any);

        expect(client.school.updateMany).toHaveBeenCalledTimes(1);
    });
});
