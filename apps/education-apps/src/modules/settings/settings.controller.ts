import { Response } from 'express';
import { getSettings, updateSettings, validateGradingPeriods, validateSchoolCycles } from './settings.service';
import { isSchoolYear } from '../school-mode/schoolYear';
import prisma from '../../config/database';
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
        const { schoolName, logo, academicYear, contactInfo, transportPricingMode, transportUniformPrice, gradingPeriods, schoolCycles, schoolYear } = req.body;

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

        let cycles: string[] | undefined;
        if (schoolCycles !== undefined) {
            const branch = await prisma.branch.findUnique({ where: { id: req.branchId! }, select: { school: { select: { institutionType: true } } } });
            try {
                cycles = validateSchoolCycles(schoolCycles, branch?.school.institutionType ?? null);
            } catch (e: any) {
                sendError(res, e.message, 'Validation error', 400);
                return;
            }
        }
        if (schoolYear !== undefined && schoolYear !== null && !isSchoolYear(schoolYear)) {
            sendError(res, 'schoolYear must look like 2026/2027', 'Validation error', 400);
            return;
        }

        const updateData: any = {};
        if (periods !== undefined) updateData.gradingPeriods = periods;
        if (schoolName) updateData.schoolName = schoolName;
        if (logo !== undefined) updateData.logo = logo;
        if (academicYear) updateData.academicYear = academicYear;
        if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
        if (transportPricingMode !== undefined) updateData.transportPricingMode = transportPricingMode;
        if (transportUniformPrice !== undefined) updateData.transportUniformPrice = transportUniformPrice;

        if (cycles !== undefined) updateData.schoolCycles = cycles;
        if (schoolYear !== undefined) updateData.schoolYear = schoolYear;

        const settings = await updateSettings(req.branchId!, updateData);

        sendSuccess(res, settings, 'Settings updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update settings', 400);
    }
};
