import prisma from '../../config/database';
import { createParent, regenerateParentToken, getParentByRawToken } from './parents.service';
import * as accessToken from '../../utils/accessToken';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        parent: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    },
}));

describe('parents.service', () => {
    afterEach(() => jest.clearAllMocks());

    it('createParent stores a hash, not the raw token, and returns the raw token once', async () => {
        (prisma.parent.create as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Fatima' });

        const result = await createParent({ name: 'Fatima', phone: '0600000000' });

        expect(prisma.parent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: 'Fatima',
                phone: '0600000000',
                accessTokenHash: expect.any(String),
            }),
        });
        expect(result.rawToken).toEqual(expect.any(String));
        expect(result.parent).toEqual({ id: 'p1', name: 'Fatima' });
    });

    it('regenerateParentToken overwrites the stored hash and returns a new raw token', async () => {
        (prisma.parent.update as jest.Mock).mockResolvedValue({ id: 'p1' });

        const result = await regenerateParentToken('p1');

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
                    include: { inscriptions: true, payments: true, attendances: true },
                },
            },
        });
        expect(result).toBeNull();
    });
});
