import { Response } from 'express';
import { getSettings, updateSettings, validateGradingPeriods } from './settings.service';
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
        const { schoolName, logo, academicYear, contactInfo, transportPricingMode, transportUniformPrice, gradingPeriods } = req.body;

        if (transportPricingMode !== undefined && !['ROUTE', 'STOP', 'UNIFORM'].includes(transportPricingMode)) {
            sendError(res, 'transportPricingMode must be ROUTE, STOP or UNIFORM', 'Validation error', 400);
            return;
        }
        if (
            transportUniformPrice !== undefined &&
            transportUniformPrice !== null &&
            !(typeof transportUniformPrice === 'number' && transportUniformPrice >= 0)
        ) {
            sendError(res, 'transportUniformPrice must be a non-negative number', 'Validation error', 400);
            return;
        }

        let periods: string[] | undefined;
        if (gradingPeriods !== undefined) {
            try {
                periods = validateGradingPeriods(gradingPeriods);
            } catch (e: any) {
                sendError(res, e.message, 'Validation error', 400);
                return;
            }
        }

        const updateData: any = {};
        if (periods !== undefined) updateData.gradingPeriods = periods;
        if (schoolName) updateData.schoolName = schoolName;
        if (logo !== undefined) updateData.logo = logo;
        if (academicYear) updateData.academicYear = academicYear;
        if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
        if (transportPricingMode !== undefined) updateData.transportPricingMode = transportPricingMode;
        if (transportUniformPrice !== undefined) updateData.transportUniformPrice = transportUniformPrice;

        const settings = await updateSettings(req.branchId!, updateData);

        sendSuccess(res, settings, 'Settings updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update settings', 400);
    }
};
