import { Request, Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import * as activities from './activities.service';

export const list = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.listActivities(req.branchId!), { message: 'Activities retrieved successfully', failure: 'Failed to retrieve activities' });

export const create = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.createActivity(req.branchId!, req.body || {}), {
        message: 'Activity created successfully',
        failure: 'Failed to create activity',
        status: 201,
    });

export const update = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.updateActivity(req.branchId!, req.params.id, req.body || {}), { message: 'Activity updated successfully', failure: 'Failed to update activity' });

export const remove = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.deleteActivity(req.branchId!, req.params.id), { message: 'Activity deleted successfully', failure: 'Failed to delete activity' });

export const publish = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.setPublished(req.branchId!, req.params.id, req.body?.published), { message: 'Activity updated successfully', failure: 'Failed to publish activity' });

export const responses = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.listResponses(req.branchId!, req.params.id), { message: 'Responses retrieved successfully', failure: 'Failed to retrieve responses' });

export const setPaid = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.setPaid(req.branchId!, req.params.id, req.params.studentId, req.body?.paid), { message: 'Response updated successfully', failure: 'Failed to update response' });

export const remind = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.remind(req.branchId!, req.params.id), { message: 'Reminder sent successfully', failure: 'Failed to send reminder' });

/** Public (parent link): answer for a child. */
export const parentRespond = (req: Request, res: Response) =>
    respond(res, () => activities.respondAsParent(req.params.token, req.body || {}), { message: 'Answer saved successfully', failure: 'Failed to save answer' });
