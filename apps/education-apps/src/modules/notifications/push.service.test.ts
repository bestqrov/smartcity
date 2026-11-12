import prisma from '../../config/database';
import { subscribe, unsubscribe } from './push.service';
import { hashToken } from '../../utils/accessToken';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        parent: { findUnique: jest.fn() },
        pushSubscription: { upsert: jest.fn(), deleteMany: jest.fn() },
    },
}));

const m = (fn: unknown) => fn as jest.Mock;
const sub = { endpoint: 'https://fcm.example/abc', keys: { p256dh: 'P', auth: 'A' } };

beforeEach(() => {
    jest.clearAllMocks();
    m(prisma.parent.findUnique).mockResolvedValue({ id: 'p1', branchId: 'b1' });
});

describe('push subscribe/unsubscribe', () => {
    it('upserts by endpoint for the parent found by token hash', async () => {
        await subscribe('tok', sub, 'ar');
        expect(prisma.parent.findUnique).toHaveBeenCalledWith({ where: { accessTokenHash: hashToken('tok') }, select: { id: true, branchId: true } });
        expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
            where: { endpoint: sub.endpoint },
            create: { endpoint: sub.endpoint, p256dh: 'P', auth: 'A', lang: 'ar', parentId: 'p1', branchId: 'b1' },
            update: { p256dh: 'P', auth: 'A', lang: 'ar', parentId: 'p1', branchId: 'b1' },
        });
    });

    it('unknown token → Parent not found; bad subscription rejected', async () => {
        m(prisma.parent.findUnique).mockResolvedValueOnce(null);
        await expect(subscribe('bad', sub, 'fr')).rejects.toThrow('Parent not found');
        await expect(subscribe('tok', { endpoint: 'http://x', keys: { p256dh: 'P', auth: 'A' } }, 'fr')).rejects.toThrow('Invalid subscription');
        await expect(subscribe('tok', undefined, 'fr')).rejects.toThrow('Invalid subscription');
        expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it('defaults lang to fr', async () => {
        await subscribe('tok', sub, 'xx');
        expect(m(prisma.pushSubscription.upsert).mock.calls[0][0].create.lang).toBe('fr');
    });

    it('unsubscribe deletes only that parent endpoint', async () => {
        await unsubscribe('tok', sub.endpoint);
        expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: sub.endpoint, parentId: 'p1' } });
        await expect(unsubscribe('tok', undefined)).rejects.toThrow('endpoint is required');
    });
});
