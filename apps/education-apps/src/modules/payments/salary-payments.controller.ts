
import { Request, Response } from 'express';
import { createSalaryPayment } from './salary-payments.service';
import { sendSuccess, sendError } from '../../utils/response';

export const createSalary = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = req.body;
        const result = await createSalaryPayment(data);
        sendSuccess(res, result, 'Salary payment recorded successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to record salary payment', 400);
    }
};
