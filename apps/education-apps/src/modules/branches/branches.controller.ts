import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { createBranch, getBranchesForSchool, getBranchSummary } from './branches.service';
import { BranchLimitError, sendBranchLimitError } from '../packs/packs.limits';
import { sendSuccess, sendError } from '../../utils/response';

export const getAll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schoolId = req.user!.schoolId;
        if (!schoolId) {
            sendError(res, 'No school associated with this account', 'Access denied', 403);
            return;
        }
        const branches = await getBranchesForSchool(schoolId);
        sendSuccess(res, branches, 'Branches retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve branches', 400);
    }
};

export const getSummary = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const schoolId = req.user!.schoolId;
        if (!schoolId) {
            sendError(res, 'No school associated with this account', 'Access denied', 403);
            return;
        }
        const summary = await getBranchSummary(schoolId);
        sendSuccess(res, summary, 'Branch summary retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve branch summary', 400);
    }
};

// The school is always the caller's: req.user.schoolId, never the body.
export const create = async (req: AuthRequest, res: Response): Promise<void> => {
    const schoolId = req.user!.schoolId;
    if (!schoolId) {
        sendError(res, 'No school associated with this account', 'Access denied', 403);
        return;
    }
    try {
        const branch = await createBranch(schoolId, req.body ?? {});
        sendSuccess(res, branch, 'Branch created', 201);
    } catch (error: any) {
        if (error instanceof BranchLimitError) {
            sendBranchLimitError(res, error);
            return;
        }
        if (error?.message === 'TRIAL_EXPIRED') {
            sendError(res, 'TRIAL_EXPIRED', "Votre période d'essai de 15 jours est terminée. Contactez-nous pour activer votre école.", 403);
            return;
        }
        if (typeof error?.name === 'string' && error.name.startsWith('PrismaClient')) {
            console.error(error);
            sendError(res, 'Internal server error', 'Failed to create branch', 500);
            return;
        }
        sendError(res, error?.message ?? 'Error', 'Failed to create branch', 400);
    }
};
