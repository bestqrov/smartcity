import prisma from '../../config/database';
import { createGroup, getAllGroups, getGroupById, updateGroup, deleteGroup } from './groups.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        group: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
        student: { findMany: jest.fn() },
        teacher: { findFirst: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createGroup stamps branchId from the given value and rejects students outside that branch', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 's1', branchId: 'b1' }]);
        (prisma.group.create as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'b1' });

        await createGroup({ name: 'G1', type: 'SOUTIEN', studentIds: ['s1'], branchId: 'b1' } as any);

        expect(prisma.group.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('createGroup throws when a given studentId belongs to a different branch', async () => {
        (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 's1', branchId: 'b1' }]);

        await expect(
            createGroup({ name: 'G1', type: 'SOUTIEN', studentIds: ['s1', 's2'], branchId: 'b1' } as any)
        ).rejects.toThrow('One or more students do not belong to this branch');
    });

    it('createGroup throws when teacherId belongs to a different branch', async () => {
        (prisma.teacher.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
            createGroup({ name: 'G1', type: 'SOUTIEN', teacherId: 'te1', branchId: 'b1' } as any)
        ).rejects.toThrow('Teacher does not belong to this branch');
    });

    it('getAllGroups only returns groups in the given branch', async () => {
        (prisma.group.findMany as jest.Mock).mockResolvedValue([]);

        await getAllGroups('b1');

        expect(prisma.group.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getGroupById throws for a group outside the given branch', async () => {
        (prisma.group.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(getGroupById('g1', 'b1')).rejects.toThrow('Group not found');
    });

    it('updateGroup validates new studentIds belong to the group\'s branch', async () => {
        (prisma.group.findFirst as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'b1' });
        (prisma.student.findMany as jest.Mock).mockResolvedValue([{ id: 's1', branchId: 'b1' }]);
        (prisma.group.update as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'b1' });

        await updateGroup('g1', 'b1', { studentIds: ['s1'] });

        expect(prisma.group.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'g1' },
                data: expect.objectContaining({ students: { set: [{ id: 's1' }] } })
            })
        );
    });

    it('updateGroup does not let a caller smuggle branchId into the update payload', async () => {
        (prisma.group.findFirst as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'b1' });
        (prisma.group.update as jest.Mock).mockResolvedValue({ id: 'g1', branchId: 'b1', name: 'New Name' });

        await updateGroup('g1', 'b1', { name: 'New Name', branchId: 'other-branch' } as any);

        expect(prisma.group.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.not.objectContaining({ branchId: expect.anything() })
            })
        );
    });

    it('deleteGroup throws for a group outside the given branch', async () => {
        (prisma.group.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(deleteGroup('g1', 'b1')).rejects.toThrow('Group not found');
    });
});
