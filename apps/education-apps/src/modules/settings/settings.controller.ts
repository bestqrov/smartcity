import { Request, Response } from 'express';
import { getSettings, updateSettings } from './settings.service';
import { sendSuccess, sendError } from '../../utils/response';

export const get = async (req: Request, res: Response): Promise<void> => {
    try {
        const settings = await getSettings();
        sendSuccess(res, settings, 'Settings retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve settings', 500);
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const { schoolName, logo, academicYear, contactInfo } = req.body;

        const updateData: any = {};
        if (schoolName) updateData.schoolName = schoolName;
        if (logo !== undefined) updateData.logo = logo;
        if (academicYear) updateData.academicYear = academicYear;
        if (contactInfo !== undefined) updateData.contactInfo = contactInfo;

        const settings = await updateSettings(updateData);

        sendSuccess(res, settings, 'Settings updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update settings', 400);
    }
};
