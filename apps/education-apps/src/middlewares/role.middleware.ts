import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { sendError } from '../utils/response';

export const roleMiddleware = (...allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            sendError(res, 'User not authenticated', 'Access denied', 401);
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            sendError(
                res,
                'Insufficient permissions',
                `Access denied. Required roles: ${allowedRoles.join(', ')}`,
                403
            );
            return;
        }

        next();
    };
};
