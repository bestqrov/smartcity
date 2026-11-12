import prisma from '../config/database';
import { requireSalesAgent } from './salesAgent.middleware';

jest.mock('../config/database', () => ({
    __esModule: true,
    default: { salesAgent: { findUnique: jest.fn() } },
}));

const makeRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

afterEach(() => jest.clearAllMocks());

describe('requireSalesAgent', () => {
    it('lets a linked OWNER in and attaches the agent', async () => {
        const agent = { id: 'a1', code: 'ABC', userId: 'u1' };
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(agent);
        const req: any = { user: { id: 'u1', role: 'OWNER' } };
        const next = jest.fn();

        await requireSalesAgent(req, makeRes(), next);

        expect(prisma.salesAgent.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
        expect(next).toHaveBeenCalled();
        expect(req.salesAgent).toBe(agent);
    });

    it('refuses a plain OWNER with 403 Not a sales agent', async () => {
        (prisma.salesAgent.findUnique as jest.Mock).mockResolvedValue(null);
        const res = makeRes();
        const next = jest.fn();

        await requireSalesAgent({ user: { id: 'u2', role: 'OWNER' } } as any, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Not a sales agent' }));
    });

    it('refuses an unauthenticated request', async () => {
        const res = makeRes();
        await requireSalesAgent({} as any, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
