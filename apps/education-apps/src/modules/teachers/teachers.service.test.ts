import prisma from '../../config/database';
import { createTeacher, getAllTeachers, updateTeacher, deleteTeacher, issueTeacherLink } from './teachers.service';
import { hashToken } from '../../utils/accessToken';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        teacher: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createTeacher stamps branchId from the given value', async () => {
        (prisma.teacher.create as jest.Mock).mockResolvedValue({ id: 't1', branchId: 'b1' });

        await createTeacher({ name: 'Prof A', branchId: 'b1' } as any);

        expect(prisma.teacher.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAllTeachers only returns teachers in the given branch', async () => {
        (prisma.teacher.findMany as jest.Mock).mockResolvedValue([]);

        await getAllTeachers('b1');

        expect(prisma.teacher.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('updateTeacher throws for a teacher outside the given branch', async () => {
        (prisma.teacher.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateTeacher('t1', 'b1', { name: 'New Name' })).rejects.toThrow('Teacher not found');
        expect(prisma.teacher.findFirst).toHaveBeenCalledWith({ where: { id: 't1', branchId: 'b1' } });
    });

    it('updateTeacher does not let a caller smuggle branchId into the update payload', async () => {
        (prisma.teacher.findFirst as jest.Mock).mockResolvedValue({ id: 't1', branchId: 'b1' });
        (prisma.teacher.update as jest.Mock).mockResolvedValue({ id: 't1', branchId: 'b1', name: 'New Name' });

        await updateTeacher('t1', 'b1', { branchId: 'other-branch', name: 'New Name' } as any);

        expect(prisma.teacher.update).toHaveBeenCalledWith({
            where: { id: 't1' },
            data: { name: 'New Name' }
        });
    });

    it('deleteTeacher throws for a teacher outside the given branch', async () => {
        (prisma.teacher.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(deleteTeacher('t1', 'b1')).rejects.toThrow('Teacher not found');
        expect(prisma.teacher.findFirst).toHaveBeenCalledWith({ where: { id: 't1', branchId: 'b1' } });
    });
});

describe('issueTeacherLink', () => {
    afterEach(() => jest.clearAllMocks());

    it('stores only the hash of a new token and returns the raw token once', async () => {
        (prisma.teacher.findFirst as jest.Mock).mockResolvedValue({ id: 't1', branchId: 'b1' });
        (prisma.teacher.update as jest.Mock).mockResolvedValue({ id: 't1' });

        const result = await issueTeacherLink('t1', 'b1');

        expect(prisma.teacher.findFirst).toHaveBeenCalledWith({ where: { id: 't1', branchId: 'b1' } });
        const data = (prisma.teacher.update as jest.Mock).mock.calls[0][0].data;
        expect(data.accessTokenHash).toBe(hashToken(result.rawToken));
        expect(data.linkIssuedAt).toEqual(expect.any(Date));
        expect(result).toEqual({ rawToken: expect.any(String), linkIssuedAt: data.linkIssuedAt });
    });

    it('refuses a teacher of another branch', async () => {
        (prisma.teacher.findFirst as jest.Mock).mockResolvedValue(null);
        await expect(issueTeacherLink('t1', 'b2')).rejects.toThrow('Teacher not found');
        expect(prisma.teacher.update).not.toHaveBeenCalled();
    });
});
