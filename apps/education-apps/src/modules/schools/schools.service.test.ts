import prisma from '../../config/database';
import {
    signupSchool,
    getSchoolBySchoolId,
    updateSchoolProfile,
    listSchools,
    updateSchoolStatus,
    assignPackToSchool,
} from './schools.service';
import * as bcryptUtil from '../../utils/bcrypt';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
        school: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
        pack: { findFirst: jest.fn() },
        $transaction: jest.fn(),
    },
}));

const baseInput = {
    ownerName: 'Owner',
    ownerEmail: 'owner@example.com',
    password: 'secret123',
    institutionType: 'PRIVATE_SCHOOL' as const,
};

const arrangeSignup = () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);
    jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed-secret');

    const school = { id: 'school1', name: 'Ecole A' };
    const branch = { id: 'branch1', schoolId: 'school1' };
    const user = { id: 'user1', email: 'owner@example.com', role: 'OWNER', schoolId: 'school1' };
    const txClient = {
        school: { create: jest.fn().mockResolvedValue(school) },
        branch: { create: jest.fn().mockResolvedValue(branch) },
        user: { create: jest.fn().mockResolvedValue(user) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(txClient));
    return { school, branch, user, txClient };
};

const pack = (over: Record<string, unknown> = {}) => ({
    id: 'pack1',
    code: 'pro',
    active: true,
    isDefault: true,
    institutionTypes: ['PRIVATE_SCHOOL', 'TUTORING_CENTER'],
    ...over,
});

describe('signupSchool', () => {
    afterEach(() => jest.restoreAllMocks());

    it('throws if the owner email is already registered', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(
            signupSchool({ ...baseInput, schoolName: 'Ecole A', ownerPhone: '0600000000', branchName: 'Main', branchCity: 'Casablanca' })
        ).rejects.toThrow('Email already exists');
    });

    it('creates School, Branch, and an OWNER User atomically with a hashed password', async () => {
        const { school, branch, user, txClient } = arrangeSignup();

        const result = await signupSchool({
            ...baseInput,
            schoolName: 'Ecole A',
            ownerPhone: '0600000000',
            branchName: 'Main',
            branchCity: 'Casablanca',
        });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: 'Ecole A',
                    status: 'PENDING',
                    institutionType: 'PRIVATE_SCHOOL',
                    packId: null,
                }),
            })
        );
        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ schoolId: 'school1', name: 'Main', city: 'Casablanca' }),
            })
        );
        expect(txClient.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    email: 'owner@example.com',
                    password: 'hashed-secret',
                    role: 'OWNER',
                    schoolId: 'school1',
                }),
            })
        );
        expect(result).toEqual({ school, branch, user });
    });

    it('translates a P2002 unique-constraint race into the friendly duplicate-email message', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed-secret');
        (prisma.$transaction as jest.Mock).mockRejectedValue(
            Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
                code: 'P2002',
                name: 'PrismaClientKnownRequestError',
            })
        );

        await expect(signupSchool({ ...baseInput, schoolName: 'Ecole A' })).rejects.toThrow('Email already exists');
    });

    it('fills in schoolName, branchName and branchCity when omitted, and stamps a 15-day trialEndsAt', async () => {
        const { txClient } = arrangeSignup();

        const before = Date.now();
        await signupSchool(baseInput);
        const after = Date.now();

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: 'École de Owner', status: 'PENDING' }),
            })
        );
        const createdTrialEndsAt: Date = (txClient.school.create as jest.Mock).mock.calls[0][0].data.trialEndsAt;
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        expect(createdTrialEndsAt.getTime()).toBeGreaterThanOrEqual(before + fifteenDaysMs - 1000);
        expect(createdTrialEndsAt.getTime()).toBeLessThanOrEqual(after + fifteenDaysMs + 1000);
        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ schoolId: 'school1', name: 'Établissement principal', city: '' }),
            })
        );
    });

    it('still honors explicit schoolName/branchName/branchCity', async () => {
        const { txClient } = arrangeSignup();

        await signupSchool({ ...baseInput, schoolName: 'Ecole A', branchName: 'Main', branchCity: 'Casablanca' });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ name: 'Ecole A' }) })
        );
        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ name: 'Main', city: 'Casablanca' }) })
        );
    });
});

describe('signupSchool — institution type and pack', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.restoreAllMocks());

    it('rejects a missing or invalid institutionType before touching the database', async () => {
        await expect(signupSchool({ ...baseInput, institutionType: undefined as any })).rejects.toThrow(
            'institutionType is required and must be valid'
        );
        await expect(signupSchool({ ...baseInput, institutionType: 'UNIVERSITY' as any })).rejects.toThrow(
            'institutionType is required and must be valid'
        );
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('assigns the pack named by packCode when it is active and serves the type', async () => {
        const { txClient } = arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack({ isDefault: false }));

        await signupSchool({ ...baseInput, packCode: 'pro' });

        expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { code: 'pro', active: true } });
        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ institutionType: 'PRIVATE_SCHOOL', packId: 'pack1' }),
            })
        );
    });

    it.each([[{}], [42], [['pro']]])('rejects non-string packCode %j before any pack query', async (bad) => {
        arrangeSignup();

        await expect(signupSchool({ ...baseInput, packCode: bad as any })).rejects.toThrow(
            'Unknown or unavailable pack'
        );
        expect(prisma.pack.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a blank packCode string that is not empty', async () => {
        arrangeSignup();

        await expect(signupSchool({ ...baseInput, packCode: '   ' })).rejects.toThrow('Unknown or unavailable pack');
        expect(prisma.pack.findFirst).not.toHaveBeenCalled();
    });

    it('trims packCode before the lookup', async () => {
        arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack({ isDefault: false }));

        await signupSchool({ ...baseInput, packCode: ' pro ' });

        expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { code: 'pro', active: true } });
    });

    it('treats an empty packCode like no code (default pack lookup)', async () => {
        arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());

        await signupSchool({ ...baseInput, packCode: '' });

        expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { isDefault: true, active: true, institutionTypes: { has: 'PRIVATE_SCHOOL' } } });
    });

    it('rejects an unknown or inactive packCode', async () => {
        arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(signupSchool({ ...baseInput, packCode: 'nope' })).rejects.toThrow('Unknown or unavailable pack');
    });

    it('rejects a pack that does not serve the chosen institution type', async () => {
        arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());

        await expect(signupSchool({ ...baseInput, institutionType: 'CRECHE', packCode: 'pro' })).rejects.toThrow(
            'Unknown or unavailable pack'
        );
    });

    it('uses the default pack when no packCode is given and it serves the type', async () => {
        const { txClient } = arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());

        await signupSchool(baseInput);

        expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { isDefault: true, active: true, institutionTypes: { has: 'PRIVATE_SCHOOL' } } });
        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ packId: 'pack1' }) })
        );
    });

    it('leaves packId null when the chosen type has no default pack, and still succeeds', async () => {
        const { txClient } = arrangeSignup();
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

        await signupSchool({ ...baseInput, institutionType: 'CRECHE' });

        expect(prisma.pack.findFirst).toHaveBeenCalledWith({
            where: { isDefault: true, active: true, institutionTypes: { has: 'CRECHE' } },
        });
        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ institutionType: 'CRECHE', packId: null }),
            })
        );
    });

    it('does not store the legacy packTier', async () => {
        const { txClient } = arrangeSignup();

        await signupSchool(baseInput);

        expect((txClient.school.create as jest.Mock).mock.calls[0][0].data).not.toHaveProperty('packTier');
    });
});

describe('getSchoolBySchoolId', () => {
    afterEach(() => jest.clearAllMocks());

    it('throws when the school does not exist', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getSchoolBySchoolId('missing')).rejects.toThrow('School not found');
    });

    it('returns the school with its pack', async () => {
        const school = { id: 's1', name: 'Ecole A' };
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(school);

        await expect(getSchoolBySchoolId('s1')).resolves.toEqual(school);
        expect(prisma.school.findUnique).toHaveBeenCalledWith({ where: { id: 's1' }, include: { pack: true } });
    });
});

describe('updateSchoolProfile', () => {
    afterEach(() => jest.clearAllMocks());

    it('updates only the provided fields on the given school', async () => {
        const updated = { id: 's1', name: 'New Name' };
        (prisma.school.update as jest.Mock).mockResolvedValue(updated);

        const result = await updateSchoolProfile('s1', { name: 'New Name' });

        expect(prisma.school.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { name: 'New Name' } });
        expect(result).toEqual(updated);
    });
});

describe('listSchools', () => {
    afterEach(() => jest.clearAllMocks());

    it('returns all schools ordered by newest first, with type and pack', async () => {
        const schools = [{ id: 's1' }, { id: 's2' }];
        (prisma.school.findMany as jest.Mock).mockResolvedValue(schools);

        await expect(listSchools()).resolves.toEqual(schools);
        expect(prisma.school.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { createdAt: 'desc' },
                select: expect.objectContaining({
                    institutionType: true,
                    packId: true,
                    pack: { select: { id: true, code: true, name: true } },
                }),
            })
        );
    });
});

describe('updateSchoolStatus', () => {
    afterEach(() => jest.clearAllMocks());

    it('updates the school status', async () => {
        const updated = { id: 's1', status: 'ACTIVE' };
        (prisma.school.update as jest.Mock).mockResolvedValue(updated);

        const result = await updateSchoolStatus('s1', 'ACTIVE');

        expect(prisma.school.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { status: 'ACTIVE' } });
        expect(result).toEqual(updated);
    });
});

describe('assignPackToSchool', () => {
    afterEach(() => jest.resetAllMocks());

    it('requires both ids', async () => {
        await expect(assignPackToSchool('', 'p1')).rejects.toThrow('School id is required');
        await expect(assignPackToSchool('s1', undefined as any)).rejects.toThrow('Pack id is required');
    });

    it('throws for an unknown school', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(assignPackToSchool('s1', 'p1')).rejects.toThrow('School not found');
    });

    it('throws for an unknown or inactive pack', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1', institutionType: 'PRIVATE_SCHOOL' });
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(assignPackToSchool('s1', 'p1')).rejects.toThrow('Pack not found');
        expect(prisma.pack.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', active: true } });
    });

    it('refuses a pack that does not serve the school type (null type counts as PRIVATE_SCHOOL)', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1', institutionType: 'CRECHE' });
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());

        await expect(assignPackToSchool('s1', 'pack1')).rejects.toThrow('Pack does not serve this institution type');

        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1', institutionType: null });
        (prisma.school.update as jest.Mock).mockResolvedValue({ id: 's1' });
        await expect(assignPackToSchool('s1', 'pack1')).resolves.toBeDefined();
    });

    it('updates packId and returns the school with its pack', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue({ id: 's1', institutionType: 'PRIVATE_SCHOOL' });
        (prisma.pack.findFirst as jest.Mock).mockResolvedValue(pack());
        (prisma.school.update as jest.Mock).mockResolvedValue({ id: 's1', packId: 'pack1' });

        await assignPackToSchool('s1', 'pack1');

        expect(prisma.school.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { packId: 'pack1' },
            include: { pack: true },
        });
    });
});
