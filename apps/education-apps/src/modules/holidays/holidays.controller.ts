import { Response } from 'express';
import {
    getAllHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
} from './holidays.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const getAll = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const holidays = await getAllHolidays(req.branchId!);
        sendSuccess(res, holidays, 'Holidays retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve holidays', 500);
    }
};

export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { title, startDate, endDate } = req.body;

        if (!title || !startDate || !endDate) {
            sendError(res, 'Title, startDate and endDate are required', 'Validation error', 400);
            return;
        }

        const holiday = await createHoliday({
            title,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            branchId: req.branchId!,
        });
        sendSuccess(res, holiday, 'Holiday created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create holiday', 400);
    }
};

export const update = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { title, startDate, endDate, active } = req.body;

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (startDate !== undefined) updateData.startDate = new Date(startDate);
        if (endDate !== undefined) updateData.endDate = new Date(endDate);
        if (active !== undefined) updateData.active = active;

        const holiday = await updateHoliday(id, req.branchId!, updateData);
        sendSuccess(res, holiday, 'Holiday updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update holiday', 400);
    }
};

export const remove = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await deleteHoliday(id, req.branchId!);
        sendSuccess(res, null, 'Holiday deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete holiday', 404);
    }
};
