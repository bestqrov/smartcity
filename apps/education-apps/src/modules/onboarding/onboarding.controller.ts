import { Response } from 'express';
import type { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import { getOnboarding, updateOnboarding } from './onboarding.service';

export const get = (req: TenantRequest, res: Response) =>
    respond(res, () => getOnboarding(req.branchId!), { message: 'Onboarding retrieved', failure: 'Failed to retrieve onboarding' });

export const update = (req: TenantRequest, res: Response) =>
    respond(res, () => updateOnboarding(req.branchId!, req.body ?? {}), { message: 'Onboarding updated', failure: 'Failed to update onboarding' });
