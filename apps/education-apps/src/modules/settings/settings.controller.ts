import { Response } from 'express';
import { getSettings, updateSettings } from './settings.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const get = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const settings = await getSettings(req.branchId!);
        sendSuccess(res, settings, 'Settings retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve settings', 500);
    }
};

export const update = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { schoolName, logo, academicYear, contactInfo } = req.body;

        const updateData: any = {};
        if (schoolName) updateData.schoolName = schoolName;
        if (logo !== undefined) updateData.logo = logo;
        if (academicYear) updateData.academicYear = academicYear;
        if (contactInfo !== undefined) updateData.contactInfo = contactInfo;

        const settings = await updateSettings(req.branchId!, updateData);

        sendSuccess(res, settings, 'Settings updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update settings', 400);
    }
};
