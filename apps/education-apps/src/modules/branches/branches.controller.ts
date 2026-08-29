import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { getBranchesForSchool, getBranchSummary } from './branches.service';
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
