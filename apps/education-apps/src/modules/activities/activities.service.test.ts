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
    getActivity,
    parentActivityCover,
} from './activities.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        activity: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
        activityResponse: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
        student: { findMany: jest.fn(), findFirst: jest.fn() },
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
        m(prisma.activity.findMany).mockResolvedValueOnce([{ ...base, audience: 'GROUPS', groupIds: ['g1'] }]).mockResolvedValueOnce([]);
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
        expect(m(prisma.activity.findMany).mock.calls[1][0]).toEqual({ where: { branchId: 'b1', coverImage: { isSet: true, not: null } }, select: { id: true } });
        expect(a.hasCover).toBe(false);
        expect(m(prisma.activity.findMany).mock.calls[0][0].select.coverImage).toBeUndefined();
    });

    it('listActivities: a paid response without answer counts as paid but not answered', async () => {
        m(prisma.activity.findMany).mockResolvedValueOnce([base]).mockResolvedValueOnce([{ id: 'a1' }]);
        m(prisma.student.findMany).mockResolvedValue([{ id: 's1', groupIds: [] }, { id: 's2', groupIds: [] }]);
        m(prisma.activityResponse.findMany).mockResolvedValue([{ activityId: 'a1', studentId: 's1', answer: null, paid: true }]);
        const [a] = await listActivities('b1');
        expect(a.counts).toEqual({ targeted: 2, yes: 0, no: 0, noAnswer: 2, paid: 1 });
        expect(a.hasCover).toBe(true);
    });

    it('getActivity returns the full activity with its cover', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, coverImage: 'data:image/png;base64,AA' });
        expect(await getActivity('b1', 'a1')).toMatchObject({ id: 'a1', coverImage: 'data:image/png;base64,AA', hasCover: true });
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

    it('setPaid updates an existing response', async () => {
        m(prisma.activity.findFirst).mockResolvedValue(base);
        m(prisma.activityResponse.findFirst).mockResolvedValue({ id: 'r1' });
        m(prisma.activityResponse.update).mockResolvedValue({ id: 'r1', paid: true });
        await setPaid('b1', 'a1', 's1', true);
        expect(prisma.activityResponse.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { paid: true } });
    });

    it('setPaid without a response creates one with a null answer for a targeted student', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, audience: 'GROUPS', groupIds: ['g1'] });
        m(prisma.activityResponse.findFirst).mockResolvedValue(null);
        m(prisma.student.findFirst).mockResolvedValue(null);
        await expect(setPaid('b1', 'a1', 's1', true)).rejects.toThrow('Student not found');
        m(prisma.student.findFirst).mockResolvedValue({ id: 's1', parentId: 'p1', groupIds: ['g2'] });
        await expect(setPaid('b1', 'a1', 's1', true)).rejects.toThrow('concerné');
        m(prisma.student.findFirst).mockResolvedValue({ id: 's1', parentId: 'p1', groupIds: ['g1'] });
        m(prisma.activityResponse.create).mockResolvedValue({ id: 'r2', paid: true, answer: null });
        await setPaid('b1', 'a1', 's1', true);
        expect(prisma.student.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1', branchId: 'b1', active: true } }));
        expect(prisma.activityResponse.create).toHaveBeenCalledWith({
            data: { activityId: 'a1', studentId: 's1', parentId: 'p1', branchId: 'b1', answer: null, paid: true },
        });
    });

    it('remind notifies only parents without an answer, after an atomic 24h claim', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, notifiedAt: new Date() });
        m(prisma.activity.updateMany).mockResolvedValue({ count: 1 });
        m(prisma.student.findMany).mockResolvedValue([{ id: 's1', parentId: 'p1' }, { id: 's2', parentId: 'p2' }, { id: 's3', parentId: 'p3' }]);
        m(prisma.activityResponse.findMany).mockResolvedValue([{ studentId: 's1', answer: 'YES' }, { studentId: 's3', answer: null }]);
        expect(await remind('b1', 'a1')).toMatchObject({ parents: 2, lastRemindedAt: expect.any(Date) });
        expect(notifySafely).toHaveBeenCalledWith(['p2', 'p3'], expect.objectContaining({ kind: 'ACTIVITY' }));
        const claim = m(prisma.activity.updateMany).mock.calls[0][0];
        expect(claim.where.id).toBe('a1');
        expect(claim.where.OR).toEqual([
            { lastRemindedAt: null },
            { lastRemindedAt: { isSet: false } },
            { lastRemindedAt: { lt: expect.any(Date) } },
        ]);
        const cutoff = claim.where.OR[2].lastRemindedAt.lt as Date;
        expect(Math.abs(Date.now() - 24 * 3600 * 1000 - cutoff.getTime())).toBeLessThan(5000);
    });

    it('remind refuses a second reminder within 24h', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, notifiedAt: new Date() });
        m(prisma.activity.updateMany).mockResolvedValue({ count: 0 });
        await expect(remind('b1', 'a1')).rejects.toThrow('Relance déjà envoyée il y a moins de 24 h');
        expect(notifySafely).not.toHaveBeenCalled();
    });

    it('update of a notified activity notifies only newly targeted parents', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, notifiedAt: new Date(), audience: 'GROUPS', groupIds: ['g1'] });
        m(prisma.group.findMany).mockResolvedValue([{ id: 'g1' }, { id: 'g2' }]);
        m(prisma.activity.update).mockImplementation(({ data }) => Promise.resolve({ ...base, notifiedAt: new Date(), ...data }));
        m(prisma.student.findMany)
            .mockResolvedValueOnce([{ id: 's1', parentId: 'p1' }]) // before
            .mockResolvedValueOnce([{ id: 's1', parentId: 'p1' }, { id: 's2', parentId: 'p2' }, { id: 's3', parentId: 'p1' }]); // after
        await updateActivity('b1', 'a1', { groupIds: ['g1', 'g2'] });
        expect(notifySafely).toHaveBeenCalledWith(['p2'], expect.objectContaining({ kind: 'ACTIVITY' }));
    });

    it('update without audience change, or of an unnotified activity, does not notify', async () => {
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, notifiedAt: new Date() });
        m(prisma.activity.update).mockResolvedValue(base);
        await updateActivity('b1', 'a1', { title: 'Autre' });
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, published: false, notifiedAt: null });
        m(prisma.group.findMany).mockResolvedValue([{ id: 'g1' }]);
        await updateActivity('b1', 'a1', { audience: 'GROUPS', groupIds: ['g1'] });
        expect(notifySafely).not.toHaveBeenCalled();
        expect(prisma.student.findMany).not.toHaveBeenCalled();
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

    it('deadline is an exact datetime: open until then, closed after', async () => {
        m(prisma.parent.findUnique).mockResolvedValue(parent);
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, deadline: new Date(Date.now() - 60000) });
        await expect(respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'NO' })).rejects.toThrow('date limite');
        m(prisma.activity.findFirst).mockResolvedValue({ ...base, deadline: new Date(Date.now() + 60000) });
        m(prisma.activityResponse.upsert).mockResolvedValue({ activityId: 'a1', studentId: 's1', answer: 'NO', paid: true, note: null });
        const r = await respondAsParent('tok', { activityId: 'a1', studentId: 's1', answer: 'NO' });
        expect(r).toEqual({ activityId: 'a1', studentId: 's1', answer: 'NO', paid: true, note: null });
        const call = m(prisma.activityResponse.upsert).mock.calls[0][0];
        expect(call.where).toEqual({ activityId_studentId: { activityId: 'a1', studentId: 's1' } });
        expect(call.update).not.toHaveProperty('paid');
        expect(call.create).toMatchObject({ parentId: 'p1', branchId: 'b1', answer: 'NO' });
    });

    it('parentActivityCover decodes the image for a targeted child only', async () => {
        const png = Buffer.from('hello').toString('base64');
        m(prisma.parent.findUnique).mockResolvedValue(null);
        await expect(parentActivityCover('tok', 'a1')).rejects.toThrow('Not found');
        m(prisma.parent.findUnique).mockResolvedValue(parent);
        m(prisma.activity.findFirst).mockResolvedValue({ audience: 'GROUPS', groupIds: ['g9'], coverImage: `data:image/png;base64,${png}` });
        await expect(parentActivityCover('tok', 'a1')).rejects.toThrow('Not found');
        m(prisma.activity.findFirst).mockResolvedValue({ audience: 'GROUPS', groupIds: ['g1'], coverImage: null });
        await expect(parentActivityCover('tok', 'a1')).rejects.toThrow('Not found');
        m(prisma.activity.findFirst).mockResolvedValue({ audience: 'GROUPS', groupIds: ['g1'], coverImage: `data:image/png;base64,${png}` });
        const cover = await parentActivityCover('tok', 'a1');
        expect(cover.contentType).toBe('image/png');
        expect(cover.data.toString()).toBe('hello');
        expect(m(prisma.activity.findFirst).mock.calls[0][0].where).toEqual({ id: 'a1', branchId: 'b1', published: true });
    });
});
