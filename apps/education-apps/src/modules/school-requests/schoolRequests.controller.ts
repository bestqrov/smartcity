import { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import type { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import {
    countNewSchoolRequests,
    createSchoolRequest,
    listMySchoolRequests,
    listSchoolRequests,
    updateSchoolRequest,
} from './schoolRequests.service';

// ---- school (ADMIN / OWNER): the branch is the caller's own, set by tenantScope
export const create = (req: TenantRequest, res: Response) =>
    respond(res, () => createSchoolRequest(req.branchId!, req.user!.id, req.body ?? {}), {
        message: 'Request sent',
        failure: 'Failed to send the request',
        status: 201,
    });

export const listMine = (req: TenantRequest, res: Response) =>
    respond(res, () => listMySchoolRequests(req.branchId!), {
        message: 'Requests retrieved',
        failure: 'Failed to retrieve requests',
    });

// ---- super admin
export const list = (req: AuthRequest, res: Response) =>
    respond(res, () => listSchoolRequests(req.query.status), {
        message: 'Requests retrieved',
        failure: 'Failed to retrieve requests',
    });

export const newCount = (_req: AuthRequest, res: Response) =>
    respond(res, async () => ({ pending: await countNewSchoolRequests() }), {
        message: 'New requests counted',
        failure: 'Failed to count requests',
    });

export const update = (req: AuthRequest, res: Response) =>
    respond(res, () => updateSchoolRequest(req.params.id, req.body ?? {}), {
        message: 'Request updated',
        failure: 'Failed to update the request',
    });
