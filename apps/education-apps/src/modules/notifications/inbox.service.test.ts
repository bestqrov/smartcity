import prisma from '../../config/database';
import { listInbox, markRead } from './inbox.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        parent: { findUnique: jest.fn() },
        parentNotification: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
    },
}));

const m = (fn: unknown) => fn as jest.Mock;
const row = (i: number, readAt: Date | null = null) => ({
    id: `n${i}`, parentId: 'p1', kind: 'GRADE', titleFr: 'T', titleAr: 'ت', bodyFr: 'B', bodyAr: 'ب',
    path: null, studentId: null, readAt, createdAt: new Date(Date.UTC(2026, 0, 10 - i)),
});

beforeEach(() => {
    jest.clearAllMocks();
    m(prisma.parent.findUnique).mockResolvedValue({ id: 'p1' });
    m(prisma.parentNotification.count).mockResolvedValue(2);
});

describe('listInbox', () => {
    it('unknown token throws', async () => {
        m(prisma.parent.findUnique).mockResolvedValue(null);
        await expect(listInbox('bad')).rejects.toThrow('Parent not found');
    });

    it('maps rows, scopes to the parent and has no next page when under the limit', async () => {
        m(prisma.parentNotification.findMany).mockResolvedValue([row(1), row(2, new Date())]);
        const res = await listInbox('tok');
        expect(m(prisma.parentNotification.findMany).mock.calls[0][0]).toMatchObject({ where: { parentId: 'p1' }, take: 31 });
        expect(res.unread).toBe(2);
        expect(res.nextBefore).toBeNull();
        expect(res.items[0]).toEqual({
            id: 'n1', kind: 'GRADE', title: { fr: 'T', ar: 'ت' }, body: { fr: 'B', ar: 'ب' },
            path: null, studentId: null, read: false, createdAt: row(1).createdAt,
        });
        expect(res.items[1].read).toBe(true);
    });

    it('limit clamps to 50, invalid → 30; extra row yields nextBefore', async () => {
        m(prisma.parentNotification.findMany).mockResolvedValue([row(1), row(2), row(3)]);
        const res = await listInbox('tok', '2026-02-01T00:00:00.000Z', '2');
        const arg = m(prisma.parentNotification.findMany).mock.calls[0][0];
        expect(arg.take).toBe(3);
        expect(arg.where.createdAt).toEqual({ lt: new Date('2026-02-01T00:00:00.000Z') });
        expect(res.items).toHaveLength(2);
        expect(res.nextBefore).toBe(row(2).createdAt.toISOString());
        await listInbox('tok', undefined, '999');
        expect(m(prisma.parentNotification.findMany).mock.calls[1][0].take).toBe(51);
        await listInbox('tok', undefined, 'abc');
        expect(m(prisma.parentNotification.findMany).mock.calls[2][0].take).toBe(31);
    });

    it('invalid before rejected', async () => {
        await expect(listInbox('tok', 'nope')).rejects.toThrow('Invalid before');
    });
});

describe('markRead', () => {
    it('no ids marks all unread of the parent', async () => {
        m(prisma.parentNotification.count).mockResolvedValue(0);
        const res = await markRead('tok');
        expect(prisma.parentNotification.updateMany).toHaveBeenCalledWith({
            where: { parentId: 'p1', readAt: null }, data: { readAt: expect.any(Date) },
        });
        expect(res).toEqual({ unread: 0 });
    });

    it('ids are restricted to the parent and to valid ObjectIds', async () => {
        const good = 'a'.repeat(24);
        await markRead('tok', [good, 'junk']);
        expect(m(prisma.parentNotification.updateMany).mock.calls[0][0].where).toEqual({
            parentId: 'p1', readAt: null, id: { in: [good] },
        });
    });

    it('non-array ids rejected', async () => {
        await expect(markRead('tok', 'x')).rejects.toThrow('ids must be');
    });
});
