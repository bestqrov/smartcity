import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { sendError } from '../utils/response';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}

export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            sendError(res, 'No token provided', 'Authentication required', 401);
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log('Auth Middleware - Token received:', token.substring(0, 10) + '...');

        const decoded = verifyToken(token);
        console.log('Auth Middleware - Token verified, user:', decoded.email);
        req.user = decoded;

        next();
    } catch (error: any) {
        console.error('Auth Middleware - Verification failed:', error.message);
        sendError(res, 'Invalid token', 'Authentication failed', 401);
    }
};
