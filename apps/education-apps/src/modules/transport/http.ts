import { Response } from 'express';
import { sendSuccess, sendError } from '../../utils/response';

interface RespondOptions {
    message: string;
    failure: string;
    status?: number;
}

// Runs a service call and maps the outcome to the API's { success, data | error } shape.
// Errors ending in "not found" become 404, every other thrown error is a 400.
export const respond = async (res: Response, action: () => Promise<unknown>, options: RespondOptions): Promise<void> => {
    try {
        const data = await action();
        sendSuccess(res, data, options.message, options.status ?? 200);
    } catch (error: unknown) {
        if (error instanceof Error && error.name.startsWith('PrismaClient')) {
            console.error(error);
            sendError(res, 'Internal server error', options.failure, 500);
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        const status = /not found$/i.test(message) ? 404 : 400;
        sendError(res, message, options.failure, status);
    }
};
