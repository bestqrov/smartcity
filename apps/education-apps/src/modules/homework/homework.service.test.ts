import prisma from '../../config/database';
import { listGroupHomework, createHomework, updateHomework, deleteHomework } from './homework.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        group: { findFirst: jest.fn() },
        homework: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        student: { findMany: jest.fn() },
    },
}));
jest.mock('../notifications/dispatcher', () => ({ notifySafely: jest.fn().mockResolvedValue(undefined) }));
import { notifySafely } from '../notifications/dispatcher';

const m = (fn: unknown) => fn as jest.Mock;
const staff = { branchId: 'b1' };
const teacher = { branchId: 'b1', teacherId: 't1' };
const group = { id: 'g1', name: 'G Maths', subject: 'Maths', studentIds: ['s1', 's2'] };

describe('homework.service', () => {
    afterEach(() => jest.clearAllMocks());

    it('scopes the group lookup to the teacher', async () => {
        m(prisma.group.findFirst).mockResolvedValue(null);
        await expect(listGroupHomework(teacher, 'g1')).rejects.toThrow('Group not found');
        expect(prisma.group.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'g1', branchId: 'b1', teacherId: 't1' } })
        );
    });

    it('staff lookup has no teacher filter', async () => {
        m(prisma.group.findFirst).mockResolvedValue(group);
        m(prisma.homework.findMany).mockResolvedValue([]);
        await listGroupHomework(staff, 'g1');
        expect(prisma.group.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'g1', branchId: 'b1' } }));
    });

    it('create validates, defaults subject and notifies the parents', async () => {
        m(prisma.group.findFirst).mockResolvedValue(group);
        m(prisma.homework.create).mockImplementation(({ data }) => Promise.resolve({ id: 'h1', ...data }));
        m(prisma.student.findMany).mockResolvedValue([{ parentId: 'p1' }, { parentId: null }, { parentId: 'p2' }]);

        await expect(createHomework(teacher, { groupId: 'g1', title: '', dueDate: '2026-11-20' })).rejects.toThrow('title');
        await expect(createHomework(teacher, { groupId: 'g1', title: 'Ex', dueDate: 'nope' })).rejects.toThrow('dueDate');

        const hw = await createHomework(teacher, { groupId: 'g1', title: 'Ex 3 p.12', dueDate: '2026-11-20' }, 'teacher:t1');
        expect(hw.subject).toBe('Maths');
        expect(m(prisma.homework.create).mock.calls[0][0].data).toMatchObject({ branchId: 'b1', groupId: 'g1', createdBy: 'teacher:t1' });
        expect(notifySafely).toHaveBeenCalledWith(['p1', 'p2'], expect.objectContaining({ kind: 'HOMEWORK', branchId: 'b1' }));
        expect(m(notifySafely).mock.calls[0][1].body.fr).toBe('Devoir — Maths : Ex 3 p.12 (pour le 20/11)');
    });

    it('update/delete refuse homework of another teacher group', async () => {
        m(prisma.homework.findFirst).mockResolvedValue({ id: 'h1', groupId: 'g9', branchId: 'b1' });
        m(prisma.group.findFirst).mockResolvedValue(null);
        await expect(updateHomework(teacher, 'h1', { title: 'x' })).rejects.toThrow('Group not found');
        await expect(deleteHomework(teacher, 'h1')).rejects.toThrow('Group not found');
        expect(prisma.homework.update).not.toHaveBeenCalled();
        expect(prisma.homework.delete).not.toHaveBeenCalled();
    });

    it('update applies partial fields', async () => {
        m(prisma.homework.findFirst).mockResolvedValue({ id: 'h1', groupId: 'g1', branchId: 'b1' });
        m(prisma.group.findFirst).mockResolvedValue(group);
        m(prisma.homework.update).mockResolvedValue({ id: 'h1' });
        await updateHomework(staff, 'h1', { details: 'p.4', groupId: 'other' });
        expect(prisma.homework.update).toHaveBeenCalledWith({ where: { id: 'h1' }, data: { details: 'p.4' } });
    });
});
