import prisma from '../../config/database';
import {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getSecretaries,
    updateSecretary,
} from './users.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        branch: { findUnique: jest.fn() },
    },
}));

jest.mock('../../utils/bcrypt', () => ({ hashPassword: jest.fn(async (p: string) => `hashed:${p}`) }));

const db = prisma as any;

describe('users are scoped to the branch', () => {
    afterEach(() => jest.clearAllMocks());

    it('getAllUsers only lists users of the given branch', async () => {
        db.user.findMany.mockResolvedValue([]);
        await getAllUsers('b1');
        expect(db.user.findMany.mock.calls[0][0].where).toEqual({ branchId: 'b1' });
    });

    it('getSecretaries only lists secretaries of the given branch', async () => {
        db.user.findMany.mockResolvedValue([]);
        await getSecretaries('b1');
        expect(db.user.findMany.mock.calls[0][0].where).toEqual({ branchId: 'b1', role: 'SECRETARY' });
    });

    it('getUserById does not return a user of another branch', async () => {
        db.user.findFirst.mockResolvedValue(null);
        await expect(getUserById('u1', 'b1')).rejects.toThrow('User not found');
        expect(db.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'u1', branchId: 'b1' });
    });

    it('createUser stamps the branch and its school on the new user', async () => {
        db.user.findUnique.mockResolvedValue(null);
        db.branch.findUnique.mockResolvedValue({ id: 'b1', schoolId: 's1' });
        db.user.create.mockResolvedValue({ id: 'u1' });

        await createUser({ email: 'A@x.ma', password: 'secret123', name: 'A', role: 'SECRETARY' as any, branchId: 'b1' });

        expect(db.user.create.mock.calls[0][0].data).toEqual(
            expect.objectContaining({ email: 'a@x.ma', branchId: 'b1', schoolId: 's1', role: 'SECRETARY' })
        );
    });
});

describe('users outside the branch, owners and super admins cannot be changed', () => {
    afterEach(() => jest.clearAllMocks());

    it('updateUser only looks up ADMIN/SECRETARY users of the branch', async () => {
        db.user.findFirst.mockResolvedValue(null);

        await expect(updateUser('owner-of-other-school', 'b1', { password: 'hacked123' })).rejects.toThrow('User not found');

        expect(db.user.findFirst.mock.calls[0][0].where).toEqual({
            id: 'owner-of-other-school',
            branchId: 'b1',
            role: { in: ['ADMIN', 'SECRETARY'] },
        });
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('updateUser updates a manageable user of the branch', async () => {
        db.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@x.ma', branchId: 'b1', role: 'SECRETARY' });
        db.user.update.mockResolvedValue({ id: 'u1' });

        await updateUser('u1', 'b1', { name: 'B' });

        expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' }, data: { name: 'B' } }));
    });

    it('deleteUser only deletes ADMIN/SECRETARY users of the branch', async () => {
        db.user.findFirst.mockResolvedValue(null);

        await expect(deleteUser('u-elsewhere', 'b1')).rejects.toThrow('User not found');

        expect(db.user.findFirst.mock.calls[0][0].where).toEqual({
            id: 'u-elsewhere',
            branchId: 'b1',
            role: { in: ['ADMIN', 'SECRETARY'] },
        });
        expect(db.user.delete).not.toHaveBeenCalled();
    });

    it('updateSecretary only updates secretaries of the branch', async () => {
        db.user.findFirst.mockResolvedValue(null);

        await expect(updateSecretary('u-elsewhere', 'b1', { password: 'hacked123' })).rejects.toThrow('Secretary not found');

        expect(db.user.findFirst.mock.calls[0][0].where).toEqual({ id: 'u-elsewhere', branchId: 'b1', role: 'SECRETARY' });
        expect(db.user.update).not.toHaveBeenCalled();
    });
});
