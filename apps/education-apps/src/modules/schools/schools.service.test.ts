import prisma from '../../config/database';
import {
    signupSchool,
    getSchoolBySchoolId,
    updateSchoolProfile,
    listSchools,
    updateSchoolStatus,
} from './schools.service';
import * as bcryptUtil from '../../utils/bcrypt';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
        school: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
        $transaction: jest.fn(),
    },
}));

describe('signupSchool', () => {
    afterEach(() => jest.restoreAllMocks());

    it('throws if the owner email is already registered', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(
            signupSchool({
                schoolName: 'Ecole A',
                ownerName: 'Owner',
                ownerEmail: 'owner@example.com',
                ownerPhone: '0600000000',
                password: 'secret123',
                branchName: 'Main',
                branchCity: 'Casablanca',
                packTier: 'basic',
            })
        ).rejects.toThrow('Email already exists');
    });

    it('creates School, Branch, and an OWNER User atomically with a hashed password', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
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

        const result = await signupSchool({
            schoolName: 'Ecole A',
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            ownerPhone: '0600000000',
            password: 'secret123',
            branchName: 'Main',
            branchCity: 'Casablanca',
            packTier: 'basic',
        });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: 'Ecole A', status: 'PENDING', packTier: 'basic' }),
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
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed-secret');

        // Passes the pre-check (no existing user seen yet), but the DB rejects the
        // transaction because another signup with the same email won the race.
        (prisma.$transaction as jest.Mock).mockRejectedValue(
            Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
                code: 'P2002',
                name: 'PrismaClientKnownRequestError',
            })
        );

        await expect(
            signupSchool({
                schoolName: 'Ecole A',
                ownerName: 'Owner',
                ownerEmail: 'owner@example.com',
                ownerPhone: '0600000000',
                password: 'secret123',
                branchName: 'Main',
                branchCity: 'Casablanca',
                packTier: 'basic',
            })
        ).rejects.toThrow('Email already exists');
    });

    it('fills in schoolName, branchName, branchCity, and packTier when omitted, and stamps a 15-day trialEndsAt', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        jest.spyOn(bcryptUtil, 'hashPassword').mockResolvedValue('hashed-secret');

        const school = { id: 'school1', name: 'École de Owner' };
        const branch = { id: 'branch1', schoolId: 'school1' };
        const user = { id: 'user1', email: 'owner@example.com', role: 'OWNER', schoolId: 'school1' };

        const txClient = {
            school: { create: jest.fn().mockResolvedValue(school) },
            branch: { create: jest.fn().mockResolvedValue(branch) },
            user: { create: jest.fn().mockResolvedValue(user) },
        };
        (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(txClient));

        const before = Date.now();
        await signupSchool({
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            password: 'secret123',
        });
        const after = Date.now();

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: 'École de Owner',
                    status: 'PENDING',
                    packTier: 'basic',
                }),
            })
        );
        const createdTrialEndsAt: Date = (txClient.school.create as jest.Mock).mock.calls[0][0].data.trialEndsAt;
        expect(createdTrialEndsAt).toBeInstanceOf(Date);
        const fifteenDaysMs = 15 * 24 * 60 * 60 * 1000;
        expect(createdTrialEndsAt.getTime()).toBeGreaterThanOrEqual(before + fifteenDaysMs - 1000);
        expect(createdTrialEndsAt.getTime()).toBeLessThanOrEqual(after + fifteenDaysMs + 1000);

        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    schoolId: 'school1',
                    name: 'Établissement principal',
                    city: '',
                }),
            })
        );
    });

    it('still honors explicit schoolName/branchName/branchCity/packTier when the caller supplies them', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
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

        await signupSchool({
            schoolName: 'Ecole A',
            ownerName: 'Owner',
            ownerEmail: 'owner@example.com',
            password: 'secret123',
            branchName: 'Main',
            branchCity: 'Casablanca',
            packTier: 'premium',
        });

        expect(txClient.school.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: 'Ecole A', packTier: 'premium' }),
            })
        );
        expect(txClient.branch.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: 'Main', city: 'Casablanca' }),
            })
        );
    });
});

describe('getSchoolBySchoolId', () => {
    afterEach(() => jest.clearAllMocks());

    it('throws when the school does not exist', async () => {
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getSchoolBySchoolId('missing')).rejects.toThrow('School not found');
    });

    it('returns the school when found', async () => {
        const school = { id: 's1', name: 'Ecole A' };
        (prisma.school.findUnique as jest.Mock).mockResolvedValue(school);
        await expect(getSchoolBySchoolId('s1')).resolves.toEqual(school);
    });
});

describe('updateSchoolProfile', () => {
    afterEach(() => jest.clearAllMocks());

    it('updates only the provided fields on the given school', async () => {
        const updated = { id: 's1', name: 'New Name' };
        (prisma.school.update as jest.Mock).mockResolvedValue(updated);

        const result = await updateSchoolProfile('s1', { name: 'New Name' });

        expect(prisma.school.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { name: 'New Name' },
        });
        expect(result).toEqual(updated);
    });
});

describe('listSchools', () => {
    afterEach(() => jest.clearAllMocks());

    it('returns all schools ordered by newest first', async () => {
        const schools = [{ id: 's1' }, { id: 's2' }];
        (prisma.school.findMany as jest.Mock).mockResolvedValue(schools);

        await expect(listSchools()).resolves.toEqual(schools);
        expect(prisma.school.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ orderBy: { createdAt: 'desc' } })
        );
    });
});

describe('updateSchoolStatus', () => {
    afterEach(() => jest.clearAllMocks());

    it('updates the school status', async () => {
        const updated = { id: 's1', status: 'ACTIVE' };
        (prisma.school.update as jest.Mock).mockResolvedValue(updated);

        const result = await updateSchoolStatus('s1', 'ACTIVE');

        expect(prisma.school.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { status: 'ACTIVE' },
        });
        expect(result).toEqual(updated);
    });
});
