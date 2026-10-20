import { DEFAULT_PACK_BY_TYPE, DEFAULT_PACKS, seedPacks } from './packs.seed';

const makeClient = (opts: { defaultsExist?: boolean; defaultPackId?: string | null } = {}) => ({
    pack: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(opts.defaultsExist ? 1 : 0),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest
            .fn()
            .mockResolvedValue(opts.defaultPackId === null ? null : { id: opts.defaultPackId ?? 'default-id' }),
    },
    school: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
});

const find = (code: string) => DEFAULT_PACKS.find((p) => p.code === code)!;

describe('DEFAULT_PACKS', () => {
    it('has 14 packs with unique codes, each serving exactly one institution type', () => {
        expect(DEFAULT_PACKS).toHaveLength(14);
        expect(new Set(DEFAULT_PACKS.map((p) => p.code)).size).toBe(14);
        expect(DEFAULT_PACKS.every((p) => p.institutionTypes.length === 1)).toBe(true);
    });

    it('matches the agreed prices and student limits per type', () => {
        const row = (code: string) => [find(code).monthlyPrice, find(code).yearlyPrice, find(code).maxStudents];
        expect(row('essentiel')).toEqual([200, 2000, 100]);
        expect(row('pro')).toEqual([350, 3500, 300]);
        expect(row('premium')).toEqual([499, 4990, null]);
        expect(row('essentiel-soutien')).toEqual([170, 1700, 150]);
        expect(row('pro-soutien')).toEqual([300, 3000, 400]);
        expect(row('premium-soutien')).toEqual([399, 3990, null]);
        expect(row('essentiel-formation')).toEqual([300, 3000, 80]);
        expect(row('pro-formation')).toEqual([500, 5000, 250]);
        expect(row('premium-formation')).toEqual([900, 9000, null]);
        expect(row('essentiel-langues')).toEqual([200, 2000, 120]);
        expect(row('pro-langues')).toEqual([350, 3500, 350]);
        expect(row('premium-langues')).toEqual([650, 6500, null]);
        expect(row('creche')).toEqual([150, 1500, 99]);
        expect(row('creche-plus')).toEqual([200, 2000, null]);
    });

    it('limits branches to 1 / 2 / unlimited by tier', () => {
        expect([find('essentiel').maxBranches, find('pro').maxBranches, find('premium').maxBranches]).toEqual([1, 2, null]);
        expect(find('creche').maxBranches).toBe(1);
    });

    it('gives TRANSPORT only to the private-school Premium, and DAILY_LOG only to the crèche packs', () => {
        const withTransport = DEFAULT_PACKS.filter((p) => p.features.includes('TRANSPORT')).map((p) => p.code);
        expect(withTransport).toEqual(['premium']);
        const withDailyLog = DEFAULT_PACKS.filter((p) => p.features.includes('DAILY_LOG')).map((p) => p.code);
        expect(withDailyLog).toEqual(['creche', 'creche-plus']);
        expect(find('essentiel-soutien').features).toEqual([]);
        expect(find('pro-formation').features).toEqual([
            'PARENT_PORTAL',
            'STUDENT_PORTAL',
            'QR_ATTENDANCE',
            'ANNOUNCEMENTS',
            'FINANCE_ANALYTICS',
        ]);
        expect(find('creche').features).toEqual(['PARENT_PORTAL', 'DAILY_LOG']);
    });

    it('names a default pack for every institution type', () => {
        expect(DEFAULT_PACK_BY_TYPE).toEqual({
            PRIVATE_SCHOOL: 'pro',
            TUTORING_CENTER: 'pro-soutien',
            VOCATIONAL_TRAINING: 'pro-formation',
            LANGUAGE_CENTER: 'pro-langues',
            CRECHE: 'creche',
        });
        for (const code of Object.values(DEFAULT_PACK_BY_TYPE)) expect(find(code)).toBeDefined();
    });
});

describe('seedPacks', () => {
    it('narrows the three originally shared packs to private schools, only if their types are still the original list', async () => {
        const client = makeClient({ defaultsExist: true });

        await seedPacks(client as any);

        expect(client.pack.updateMany).toHaveBeenCalledWith({
            where: {
                code: { in: ['essentiel', 'pro', 'premium'] },
                institutionTypes: {
                    equals: ['PRIVATE_SCHOOL', 'TUTORING_CENTER', 'VOCATIONAL_TRAINING', 'LANGUAGE_CENTER'],
                },
            },
            data: { institutionTypes: ['PRIVATE_SCHOOL'] },
        });
    });

    it('upserts every pack by code without overwriting existing ones', async () => {
        const client = makeClient({ defaultsExist: true });

        await seedPacks(client as any);

        expect(client.pack.upsert).toHaveBeenCalledTimes(14);
        const call = client.pack.upsert.mock.calls.find((c: any[]) => c[0].where.code === 'pro-soutien')![0];
        expect(call.update).toEqual({});
        expect(call.create).toEqual(
            expect.objectContaining({ code: 'pro-soutien', institutionTypes: ['TUTORING_CENTER'], isDefault: false, active: true })
        );
    });

    it('makes each type\'s default pack the default only when that type has none', async () => {
        const none = makeClient({ defaultsExist: false });
        await seedPacks(none as any);
        expect(none.pack.update.mock.calls.map((c: any[]) => c[0].where.code)).toEqual([
            'pro',
            'pro-soutien',
            'pro-formation',
            'pro-langues',
            'creche',
        ]);
        expect(none.pack.update).toHaveBeenCalledWith({ where: { code: 'creche' }, data: { isDefault: true } });
        expect(none.pack.count).toHaveBeenCalledWith({ where: { isDefault: true, institutionTypes: { has: 'CRECHE' } } });

        const some = makeClient({ defaultsExist: true });
        await seedPacks(some as any);
        expect(some.pack.update).not.toHaveBeenCalled();
    });

    it('backfills institutionType, then packId per type from that type\'s default pack', async () => {
        const client = makeClient({ defaultsExist: true, defaultPackId: 'default-id' });

        await seedPacks(client as any);

        expect(client.school.updateMany).toHaveBeenCalledWith({
            where: { OR: [{ institutionType: null }, { institutionType: { isSet: false } }] },
            data: { institutionType: 'PRIVATE_SCHOOL' },
        });
        expect(client.pack.findFirst).toHaveBeenCalledWith({
            where: { isDefault: true, active: true, institutionTypes: { has: 'TUTORING_CENTER' } },
        });
        expect(client.school.updateMany).toHaveBeenCalledWith({
            where: { OR: [{ packId: null }, { packId: { isSet: false } }], institutionType: 'TUTORING_CENTER' },
            data: { packId: 'default-id' },
        });
        expect(client.school.updateMany).toHaveBeenCalledTimes(1 + 5);
    });

    it('skips the pack backfill for a type without a default pack', async () => {
        const client = makeClient({ defaultsExist: true, defaultPackId: null });

        await seedPacks(client as any);

        expect(client.school.updateMany).toHaveBeenCalledTimes(1);
    });
});
