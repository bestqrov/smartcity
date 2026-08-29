import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { sendError } from '../utils/response';

export interface TenantRequest extends AuthRequest {
    branchId?: string;
}

export const tenantScopeMiddleware = async (
    req: TenantRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const user = req.user;

    if (!user) {
        sendError(res, 'User not authenticated', 'Access denied', 401);
        return;
    }

    if (user.role === 'ADMIN' || user.role === 'SECRETARY') {
        if (!user.branchId) {
            sendError(res, 'User has no assigned branch', 'Access denied', 403);
            return;
        }
        req.branchId = user.branchId;
        next();
        return;
    }

    if (user.role === 'OWNER') {
        const requestedBranchId = req.header('x-branch-id');

        if (!requestedBranchId) {
            sendError(res, 'A branch must be selected', 'Branch required', 400);
            return;
        }

        let branch;
        try {
            branch = await prisma.branch.findUnique({ where: { id: requestedBranchId } });
        } catch (error) {
            sendError(res, 'Invalid branch identifier', 'Branch required', 400);
            return;
        }

        if (!branch || branch.schoolId !== user.schoolId) {
            sendError(res, 'Branch does not belong to your school', 'Access denied', 403);
            return;
        }

        req.branchId = requestedBranchId;
        next();
        return;
    }

    sendError(res, 'This role cannot access branch-scoped resources', 'Access denied', 403);
};
