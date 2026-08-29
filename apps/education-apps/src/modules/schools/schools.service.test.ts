import prisma from '../../config/database';
import { signupSchool } from './schools.service';
import * as bcryptUtil from '../../utils/bcrypt';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
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
});
