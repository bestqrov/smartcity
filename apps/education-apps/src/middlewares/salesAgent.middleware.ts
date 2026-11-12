import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';
import { sendError } from '../utils/response';

export interface SalesAgentRequest extends AuthRequest {
    salesAgent?: { id: string; code: string; userId: string | null };
}

// Lets any authenticated account with a linked SalesAgent in (a SALES_AGENT user, or a school owner who is also an agent).
export const requireSalesAgent = async (req: SalesAgentRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
        sendError(res, 'User not authenticated', 'Access denied', 401);
        return;
    }
    try {
        const agent = await prisma.salesAgent.findUnique({ where: { userId: req.user.id } });
        if (!agent) {
            sendError(res, 'Not a sales agent', 'Access denied', 403);
            return;
        }
        req.salesAgent = agent;
        next();
    } catch (error) {
        console.error(error);
        sendError(res, 'Internal server error', 'Failed to check sales agent access', 500);
    }
};
