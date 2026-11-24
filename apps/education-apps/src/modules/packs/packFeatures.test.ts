import prisma from '../../config/database';
import { branchHasFeature, requireFeature, requireFeatureForToken } from './packFeatures';

jest.mock('../../config/database', () => ({ __esModule: true, default: { branch: { findUnique: jest.fn() } } }));

const db = prisma as any;
const withPack = (features: string[] | null) =>
    db.branch.findUnique.mockResolvedValue({ school: { pack: features === null ? null : { features } } });

const run = async (middleware: any, req: any) => {
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    await middleware(req, res, next);
    return { res, next };
};

beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => jest.clearAllMocks());

describe('branchHasFeature', () => {
    it('follows the boxes checked on the pack', async () => {
        withPack(['TRANSPORT']);
        expect(await branchHasFeature('b1', 'TRANSPORT')).toBe(true);
        expect(await branchHasFeature('b1', 'PARENT_PORTAL')).toBe(false);
    });

    it('lets a school without pack keep everything', async () => {
        withPack(null);
        expect(await branchHasFeature('b1', 'PARENT_PORTAL')).toBe(true);
    });
});

describe('requireFeature', () => {
    it('lets the request through when the pack has the option', async () => {
        withPack(['ANNOUNCEMENTS']);
        const { next, res } = await run(requireFeature('ANNOUNCEMENTS'), { branchId: 'b1' });
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('answers 403 FEATURE_NOT_IN_PACK otherwise', async () => {
        withPack([]);
        const { next, res } = await run(requireFeature('TRANSPORT'), { branchId: 'b1' });
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json.mock.calls[0][0].error).toBe('FEATURE_NOT_IN_PACK');
    });
});

describe('requireFeatureForToken', () => {
    it('blocks a parent link of a school whose pack has no parent portal', async () => {
        withPack(['TRANSPORT']);
        const { next, res } = await run(requireFeatureForToken('PARENT_PORTAL', async () => 'b1'), { params: { token: 't' } });
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('leaves unknown tokens to the route (it answers not found)', async () => {
        const { next } = await run(requireFeatureForToken('PARENT_PORTAL', async () => null), { params: { token: 'zzz' } });
        expect(next).toHaveBeenCalled();
        expect(db.branch.findUnique).not.toHaveBeenCalled();
    });
});
