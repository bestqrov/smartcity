import { Response } from 'express';
import { createSalaryPayment } from './salary-payments.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const createSalary = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const result = await createSalaryPayment({ ...req.body, branchId: req.branchId! });
        sendSuccess(res, result, 'Salary payment recorded successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to record salary payment', 400);
    }
};
