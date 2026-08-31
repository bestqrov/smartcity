import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { sendError } from '../utils/response';

export interface TenantRequest extends AuthRequest {
    branchId?: string;
}

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

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

    let branchId: string;

    if (user.role === 'ADMIN' || user.role === 'SECRETARY') {
        if (!user.branchId) {
            sendError(res, 'User has no assigned branch', 'Access denied', 403);
            return;
        }
        branchId = user.branchId;
    } else if (user.role === 'OWNER') {
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

        branchId = requestedBranchId;
    } else {
        sendError(res, 'This role cannot access branch-scoped resources', 'Access denied', 403);
        return;
    }

    req.branchId = branchId;

    if (WRITE_METHODS.includes(req.method)) {
        let branchWithSchool;
        try {
            branchWithSchool = await prisma.branch.findUnique({
                where: { id: branchId },
                include: { school: true },
            });
        } catch (error) {
            branchWithSchool = null;
        }

        const school = branchWithSchool?.school;
        if (school && school.status === 'PENDING' && school.trialEndsAt && new Date() > school.trialEndsAt) {
            sendError(
                res,
                'TRIAL_EXPIRED',
                "Votre période d'essai de 15 jours est terminée. Contactez-nous pour activer votre école.",
                403
            );
            return;
        }
    }

    next();
};
