import { Response } from 'express';
import {
    getAllAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
} from './announcements.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const getAll = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const announcements = await getAllAnnouncements(req.branchId!);
        sendSuccess(res, announcements, 'Announcements retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve announcements', 500);
    }
};

export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { title, body } = req.body;

        if (!title || !body) {
            sendError(res, 'Title and body are required', 'Validation error', 400);
            return;
        }

        const announcement = await createAnnouncement({ title, body, branchId: req.branchId! });
        sendSuccess(res, announcement, 'Announcement created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create announcement', 400);
    }
};

export const update = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { title, body, active } = req.body;

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (body !== undefined) updateData.body = body;
        if (active !== undefined) updateData.active = active;

        const announcement = await updateAnnouncement(id, req.branchId!, updateData);
        sendSuccess(res, announcement, 'Announcement updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update announcement', 400);
    }
};

export const remove = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await deleteAnnouncement(id, req.branchId!);
        sendSuccess(res, null, 'Announcement deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete announcement', 404);
    }
};
