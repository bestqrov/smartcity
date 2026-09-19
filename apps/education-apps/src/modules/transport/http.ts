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
    } catch (error: any) {
        const status = /not found$/i.test(error.message) ? 404 : 400;
        sendError(res, error.message, options.failure, status);
    }
};
