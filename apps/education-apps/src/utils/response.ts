import { Response } from 'express';

interface SuccessResponse {
    success: true;
    data: any;
    message?: string;
}

interface ErrorResponse {
    success: false;
    error: string;
    message?: string;
}

export const sendSuccess = (
    res: Response,
    data: any,
    message?: string,
    statusCode: number = 200
): Response => {
    const response: SuccessResponse = {
        success: true,
        data,
    };

    if (message) {
        response.message = message;
    }

    return res.status(statusCode).json(response);
};

export const sendError = (
    res: Response,
    error: string,
    message?: string,
    statusCode: number = 400
): Response => {
    const response: ErrorResponse = {
        success: false,
        error,
    };

    if (message) {
        response.message = message;
    }

    return res.status(statusCode).json(response);
};
