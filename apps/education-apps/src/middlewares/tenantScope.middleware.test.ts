import { Response } from 'express';
import prisma from '../config/database';
import { tenantScopeMiddleware, TenantRequest } from './tenantScope.middleware';

jest.mock('../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findUnique: jest.fn() },
    },
}));

const makeRes = () => {
    const res: Partial<Response> = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    return res as Response;
};

describe('tenantScopeMiddleware', () => {
    afterEach(() => jest.clearAllMocks());

    it('rejects an unauthenticated request', async () => {
        const req = {} as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('uses the fixed branchId from the token for ADMIN, ignoring any header', async () => {
        const req = {
            user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', schoolId: null, branchId: 'b1' },
            header: jest.fn().mockReturnValue('some-other-branch'),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(req.branchId).toBe('b1');
        expect(next).toHaveBeenCalled();
    });

    it('rejects ADMIN with no assigned branch', async () => {
        const req = {
            user: { id: 'u1', email: 'a@b.com', role: 'ADMIN', schoolId: null, branchId: null },
            header: jest.fn(),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('requires an X-Branch-Id header for OWNER', async () => {
        const req = {
            user: { id: 'u1', email: 'o@b.com', role: 'OWNER', schoolId: 's1', branchId: null },
            header: jest.fn().mockReturnValue(undefined),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('accepts a branch header that belongs to the OWNER\'s school', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 'b1', schoolId: 's1' });
        const req = {
            user: { id: 'u1', email: 'o@b.com', role: 'OWNER', schoolId: 's1', branchId: null },
            header: jest.fn().mockReturnValue('b1'),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(req.branchId).toBe('b1');
        expect(next).toHaveBeenCalled();
    });

    it('rejects a branch header belonging to a different school', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue({ id: 'b2', schoolId: 'some-other-school' });
        const req = {
            user: { id: 'u1', email: 'o@b.com', role: 'OWNER', schoolId: 's1', branchId: null },
            header: jest.fn().mockReturnValue('b2'),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 (not a hang/crash) when the branch lookup throws for a malformed id', async () => {
        (prisma.branch.findUnique as jest.Mock).mockRejectedValue(new Error('Malformed ObjectID'));
        const req = {
            user: { id: 'u1', email: 'o@b.com', role: 'OWNER', schoolId: 's1', branchId: null },
            header: jest.fn().mockReturnValue('not-a-valid-id'),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects SUPER_ADMIN on branch-scoped routes (out of scope for now)', async () => {
        const req = {
            user: { id: 'u1', email: 's@b.com', role: 'SUPER_ADMIN', schoolId: null, branchId: null },
            header: jest.fn(),
        } as unknown as TenantRequest;
        const res = makeRes();
        const next = jest.fn();

        await tenantScopeMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
