import prisma from '../../config/database';
import {
    isTargeted,
    targetedStudents,
    listActivities,
    createActivity,
    updateActivity,
    setPublished,
    setPaid,
    remind,
    respondAsParent,
    listResponses,
} from './activities.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        activity: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
        activityResponse: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
        student: { findMany: jest.fn() },
        group: { findMany: jest.fn() },
        parent: { findUnique: jest.fn(), findMany: jest.fn() },
    },
}));
jest.mock('../notifications/dispatcher', () => ({ notifySafely: jest.fn().mockResolvedValue(undefined) }));
import { notifySafely } from '../notifications/dispatcher';

const m = (fn: unknown) => fn as jest.Mock;
const future = new Date(Date.now() + 10 * 86400000);
const base = { id: 'a1', branchId: 'b1', title: 'Sortie', startAt: future, audience: 'ALL', groupIds: [] as string[], published: true, notifiedAt: null, deadline: null };

describe('activities audience', () => {
    afterEach(() => jest.clearAllMocks());

    it('isTargeted: ALL targets everyone, GROUPS only members', () => {
        expect(isTargeted({ audience: 'ALL', groupIds: [] }, { groupIds: [] })).toBe(true);
        expect(isTargeted({ audience: 'GROUPS', groupIds: ['g1'] }, { groupIds: ['g2', 'g1'] })).toBe(true);
        expect(isTargeted({ audience: 'GROUPS', groupIds: ['g1'] }, { groupIds: ['g2'] })).toBe(false);
    });

    it('targetedStudents queries active branch students, filtered by groups for GROUPS', async () => {
        m(prisma.student.findMany).mockResolvedValue([]);
        await targetedStudents('b1', { audience: 'ALL', groupIds: [] });
        expect(m(prisma.student.findMany).mock.calls[0][0].where).toEqual({ branchId: 'b1', active: true });
        await targetedStudents('b1', { audience: 'GROUPS', groupIds: ['g1', 'g2'] });
        expect(m(prisma.student.findMany).mock.calls[1][0].where).toEqual({ branchId: 'b1', active: true, groupIds: { hasSome: ['g1', 'g2'] } });
        expect(await targetedStudents('b1', { audience: 'GROUPS', groupIds: [] })).toEqual([]);
    });

    it('listActivities computes counters over targeted students', async () => {
        m(prisma.activity.findMany).mockResolvedValue([{ ...base, audience: 'GROUPS', groupIds: ['g1'] }]);
        m(prisma.student.findMany).mockResolvedValue([
            { id: 's1', groupIds: ['g1'] },
            { id: 's2', groupIds: ['g1'] },
            { id: 's3', groupIds: ['g1'] },
            { id: 's4', groupIds: ['g2'] },
        ]);
        m(prisma.activityResponse.findMany).mockResolvedValue([
            { activityId: 'a1', studentId: 's1', answer: 'YES', paid: true },
            { activityId: 'a1', studentId: 's2', answer: 'NO', paid: false },
            { activityId: 'a1', studentId: 's4', answer: 'YES', paid: true }, // no longer targeted
        ]);
        const [a] = await listActivities('b1');
        expect(a.counts).toEqual({ targeted: 3, yes: 1, no: 1, noAnswer: 1, paid: 1 });
    });
});

describe('activities validation', () => {
    afterEach(() => jest.clearAllMocks());

    it('rejects bad input', async () => {
        await expect(createActivity('b1', { title: '', startAt: future })).rejects.toThrow('title');
        await expect(createActivity('b1', { title: 'x', startAt: 'bad' })).rejects.toThrow('startAt');
        await expect(createActivity('b1', { title: 'x', startAt: future, endAt: new Date(0) })).rejects.toThrow('endAt');
        await expect(createActivity('b1', { title: 'x', startAt: future, price: -1 })).rejects.toThrow('price');
        await expect(createActivity('b1', { title: 'x', startAt: future, coverImage: 'data:image/gif;base64,AA' })).rejects.toThrow('coverImage');
        await expect(createActivity('b1', { title: 'x', startAt: future, deadline: new Date(future.getTime() + 86400000) })).rejects.toThrow('deadline');
        await expect(createActivity('b1', { title: 'x', startAt: future, audience: 'GROUPS', groupIds: [] })).rejects.toThrow('groupIds');
        m(prisma.group.findMany).mockResolvedValue([{ id: 'g1' }]);
        await expect(createActivity('b1', { title: 'x', startAt: future, audience: 'GROUPS', groupIds: ['g1', 'gX'] })).rejects.toThrow('Group not found');
        expect(prisma.group.findMany).toHaveBeenCalledWith({ where: { id: { in: ['g1', 'gX'] }, branchId: 'b1' }, select: { id: true } });
        expect(prisma.activity.create).not.toHaveBeenCalled();
    });

    it('creates unpublished, branch-scoped', async () => {
        m(prisma.activity.create).mockResolvedValue({ id: 'a1' });
        await createActivity('b1', { title: ' Sortie ', startAt: future, price: 50, coverImage: 'data:image/png;base64,AA' });
        expect(m(prisma.activity.create).mock.calls[0][0].data).toMatchObject({ title: 'Sortie', branchId: 'b1', published: false, audience: 'ALL', groupIds: [], price: 50 });
    });

    it('update checks endAt against the stored startAt', async () => {
        m(prisma.activity.findFirst).mockResolvedValue(base);
        await expect(updateActivity('b1', 'a1', { endAt: new Date(0) })).rejects.toThrow('endAt');
    });
});

describe('activities publish / paid / remind', () => {
    afterEach(() => jest.clearAllMocks());

    it('first publish notifies targeted parents once', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, published: false });
        m(prisma.activity.update).mockResolvedValue({ ...base, published: true });
        m(prisma.activity.updateMany).mockResolvedValue({ count: 1 });
        m(prisma.student.findMany).mockResolvedValue([{ id: 's1', parentId: 'p1' }, { id: 's2', parentId: null }]);
        await setPublished('b1', 'a1', true);
        expect(prisma.activity.updateMany).toHaveBeenCalledWith({ where: { id: 'a1', notifiedAt: null }, data: { notifiedAt: expect.any(Date) } });
        expect(notifySafely).toHaveBeenCalledWith(['p1'], expect.objectContaining({ kind: 'ACTIVITY' }));
    });

    it('does not notify when the claim is lost or already notified', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, published: false });
        m(prisma.activity.updateMany).mockResolvedValue({ count: 0 });
        await setPublished('b1', 'a1', true);
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, notifiedAt: new Date() });
        await setPublished('b1', 'a1', true);
        expect(prisma.activity.updateMany).toHaveBeenCalledTimes(1);
        expect(notifySafely).not.toHaveBeenCalled();
    });

    it('setPaid requires an existing response', async () => {
        m(prisma.activity.findFirst).mockResolvedValue(base);
        m(prisma.activityResponse.findFirst).mockResolvedValue(null);
        await expect(setPaid('b1', 'a1', 's1', true)).rejects.toThrow('Pas de réponse');
        m(prisma.activityResponse.findFirst).mockResolvedValue({ id: 'r1' });
        m(prisma.activityResponse.update).mockResolvedValue({ id: 'r1', paid: true });
        await setPaid('b1', 'a1', 's1', true);
        expect(prisma.activityResponse.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { paid: true } });
    });

    it('remind notifies only parents without a response', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, notifiedAt: new Date() });
        m(prisma.student.findMany).mockResolvedValue([{ id: 's1', parentId: 'p1' }, { id: 's2', parentId: 'p2' }]);
        m(prisma.activityResponse.findMany).mockResolvedValue([{ studentId: 's1' }]);
        expect(await remind('b1', 'a1')).toEqual({ parents: 1 });
        expect(notifySafely).toHaveBeenCalledWith(['p2'], expect.objectContaining({ kind: 'ACTIVITY' }));
    });

    it('listResponses lists every targeted student with parent and answer', async () => {
        m(prisma.activity.findFirst).mockResolvedValue(base);
        m(prisma.student.findMany).mockResolvedValue([{ id: 's1', name: 'A', surname: 'B', parentId: 'p1' }, { id: 's2', name: 'C', surname: 'D', parentId: null }]);
        m(prisma.activityResponse.findMany).mockResolvedValue([{ studentId: 's1', answer: 'YES', paid: true, note: null, answeredAt: 'x' }]);
        m(prisma.parent.findMany).mockResolvedValue([{ id: 'p1', name: 'P', phone: '06' }]);
        const rows = await listResponses('b1', 'a1');
        expect(rows[0]).toMatchObject({ studentId: 's1', parentName: 'P', parentPhone: '06', answer: 'YES', paid: true });
        expect(rows[1]).toMatchObject({ studentId: 's2', parentName: null, answer: null, paid: false });
    });
});

describe('respondAsParent', () => {
    afterEach(() => jest.clearAllMocks());
    const parent = { id: 'p1', branchId: 'b1', students: [{ id: 's1', branchId: 'b1', active: true, groupIds: ['g1'] }, { id: 's9', branchId: 'b2', active: true, groupIds: [] }] };

    it('validates the answer and the token', async () => {
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'MAYBE' })).rejects.toThrow('answer');
        m(prisma.parent.findUnique).mockResolvedValue(null);
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'YES' })).rejects.toThrow('Not found');
    });

    it('refuses a student that is not the parent child in the branch', async () => {
        m(prisma.parent.findUnique).mockResolvedValue(parent);
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 'sX', answer: 'YES' })).rejects.toThrow('Student not found');
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 's9', answer: 'YES' })).rejects.toThrow('Student not found');
    });

    it('requires a published activity of the branch, audience, deadline and start', async () => {
        m(prisma.parent.findUnique).mockResolvedValue(parent);
        m(prisma.activity.findFirst).mockResolvedValue(null);
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'YES' })).rejects.toThrow('Activity not found');
        expect(prisma.activity.findFirst).toHaveBeenCalledWith({ where: { id: 'a1', branchId: 'b1', published: true } });

        m(prisma.activity.findFirst).mockResolvedValue({ ...base, audience: 'GROUPS', groupIds: ['g2'] });
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'YES' })).rejects.toThrow('concerné');

        m(prisma.activity.findFirst).mockResolvedValue({ ...base, deadline: new Date(Date.now() - 2 * 86400000) });
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'YES' })).rejects.toThrow('date limite');

        m(prisma.activity.findFirst).mockResolvedValue({ ...base, startAt: new Date(Date.now() - 1000) });
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'YES' })).rejects.toThrow('commencé');
        expect(prisma.activityResponse.upsert).not.toHaveBeenCalled();
    });

    it('a deadline of today is still open (end of day)', async () => {
        m(prisma.parent.findUnique).mockResolvedValue(parent);
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, deadline: today });
        m(prisma.activityResponse.upsert).mockResolvedValue({ activityId: 'a1', studentId: 's1', answer: 'NO', paid: true, note: null });
        const r = await respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'NO' });
        expect(r).toEqual({ activityId: 'a1', studentId: 's1', answer: 'NO', paid: true, note: null });
        const call = m(prisma.activityResponse.upsert).mock.calls[0][0];
        expect(call.where).toEqual({ activityId_studentId: { activityId: 'a1', studentId: 's1' } });
        expect(call.update).not.toHaveProperty('paid');
        expect(call.create).toMatchObject({ parentId: 'p1', branchId: 'b1', answer: 'NO' });
    });
});
