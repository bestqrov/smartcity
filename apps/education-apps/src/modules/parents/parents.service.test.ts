import prisma from '../../config/database';
import {
    createParent,
    regenerateParentToken,
    getParentByRawToken,
    getAllParents,
    getParentById,
    updateParent,
    assertParentInBranch,
} from './parents.service';
import * as accessToken from '../../utils/accessToken';
import { currentMonth } from '../transport/month';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        parent: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    },
}));

describe('parents.service', () => {
    afterEach(() => jest.clearAllMocks());

    it('createParent stores a hash, not the raw token, and returns the raw token once', async () => {
        (prisma.parent.create as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Fatima' });

        const result = await createParent({ name: 'Fatima', phone: '0600000000', branchId: 'b1' });

        expect(prisma.parent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: 'Fatima',
                phone: '0600000000',
                branchId: 'b1',
                accessTokenHash: expect.any(String),
            }),
        });
        expect(result.rawToken).toEqual(expect.any(String));
        expect(result.parent).toEqual({ id: 'p1', name: 'Fatima' });
    });

    it('regenerateParentToken overwrites the stored hash and returns a new raw token', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });
        (prisma.parent.update as jest.Mock).mockResolvedValue({ id: 'p1' });

        const result = await regenerateParentToken('p1', 'b1');

        expect(prisma.parent.update).toHaveBeenCalledWith({
            where: { id: 'p1' },
            data: { accessTokenHash: expect.any(String) },
        });
        expect(result.rawToken).toEqual(expect.any(String));
    });

    it('getParentByRawToken returns null for a token that matches no stored hash', async () => {
        (prisma.parent.findUnique as jest.Mock).mockResolvedValue(null);
        jest.spyOn(accessToken, 'hashToken').mockReturnValue('some-hash');

        const result = await getParentByRawToken('bad-token');

        expect(prisma.parent.findUnique).toHaveBeenCalledWith({
            where: { accessTokenHash: 'some-hash' },
            include: {
                students: {
                    include: {
                        inscriptions: true,
                        payments: { where: { OR: [{ transportSubscriptionId: null }, { transportSubscriptionId: { isSet: false } }] } },
                        attendances: true,
                        transportSubscriptions: {
                            where: { status: { in: ['ACTIVE', 'PAUSED'] } },
                            include: {
                                route: {
                                    include: {
                                        driver: { select: { name: true, phone: true } },
                                        vehicle: { select: { plate: true } },
                                    },
                                },
                                stop: true,
                                payments: { where: { forMonth: currentMonth() }, select: { id: true } },
                            },
                        },
                    },
                },
            },
        });
        expect(result).toBeNull();
    });
});

describe('parents are scoped to a branch', () => {
    afterEach(() => jest.clearAllMocks());

    it('lists only the branch’s parents, with only the branch’s children', async () => {
        (prisma.parent.findMany as jest.Mock).mockResolvedValue([]);

        await getAllParents('b1');

        expect(prisma.parent.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { branchId: 'b1' },
                include: { students: { where: { branchId: 'b1' } } },
            })
        );
    });

    it('does not show another school’s parent', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(getParentById('p-other', 'b1')).rejects.toThrow('Parent not found');
        expect(prisma.parent.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'p-other', branchId: 'b1' } })
        );
    });

    it('refuses to re-issue another school’s parent link, leaving their current link working', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(regenerateParentToken('p-other', 'b1')).rejects.toThrow('Parent not found');
        expect(prisma.parent.update).not.toHaveBeenCalled();
    });

    it('refuses to edit another school’s parent', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateParent('p-other', 'b1', { phone: '0700000000' })).rejects.toThrow('Parent not found');
        expect(prisma.parent.update).not.toHaveBeenCalled();
    });

    it('never lets an edit move a parent to another branch or change its access hash', async () => {
        (prisma.parent.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });
        (prisma.parent.update as jest.Mock).mockResolvedValue({ id: 'p1' });

        await updateParent('p1', 'b1', { phone: '0700000000', branchId: 'b2', accessTokenHash: 'x' } as any);

        const { data } = (prisma.parent.update as jest.Mock).mock.calls[0][0];
        expect(data.phone).toBe('0700000000');
        expect(data).not.toHaveProperty('branchId', 'b2');
        expect(data.accessTokenHash).toBeUndefined();
    });

    it('treats a malformed id as not found', async () => {
        (prisma.parent.findFirst as jest.Mock).mockRejectedValue(new Error('Malformed ObjectID'));

        await expect(assertParentInBranch('not-an-id', 'b1')).rejects.toThrow('Parent not found');
    });

    it('allows unlinking (no parent)', async () => {
        await expect(assertParentInBranch(null, 'b1')).resolves.toBeUndefined();
        expect(prisma.parent.findFirst).not.toHaveBeenCalled();
    });
});
