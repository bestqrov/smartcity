import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export const errorMiddleware = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    console.error('Error:', err);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    sendError(res, message, 'An error occurred', statusCode);
};
