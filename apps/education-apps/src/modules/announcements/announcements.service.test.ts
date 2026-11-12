import prisma from '../../config/database';
import { createAnnouncement } from './announcements.service';
import { notifySafely } from '../notifications/dispatcher';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: { announcement: { create: jest.fn() }, parent: { findMany: jest.fn() } },
}));
jest.mock('../notifications/dispatcher', () => ({ notifySafely: jest.fn().mockResolvedValue(undefined) }));

describe('createAnnouncement', () => {
    it('notifies every parent of the branch as ANNOUNCEMENT', async () => {
        (prisma.announcement.create as jest.Mock).mockResolvedValue({ id: 'a1', title: 'T', body: 'B', active: true });
        (prisma.parent.findMany as jest.Mock).mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
        await createAnnouncement({ title: 'T', body: 'B', branchId: 'b1' });
        expect(prisma.parent.findMany).toHaveBeenCalledWith({ where: { branchId: 'b1' }, select: { id: true } });
        expect(notifySafely).toHaveBeenCalledWith(['p1', 'p2'], expect.objectContaining({ kind: 'ANNOUNCEMENT', branchId: 'b1' }));
    });
});
