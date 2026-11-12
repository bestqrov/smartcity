import { Request, Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import * as activities from './activities.service';

export const list = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.listActivities(req.branchId!), { message: 'Activities retrieved successfully', failure: 'Failed to retrieve activities' });

// The list omits cover images (hasCover only); the full activity, cover included, comes from GET /:id.
export const get = (req: TenantRequest, res: Response) =>
    respond(res, () => activities.getActivity(req.branchId!, req.params.id), { message: 'Activity retrieved successfully', failure: 'Failed to retrieve activity' });

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

/** Public (parent link): the activity cover as image bytes, so the profile JSON stays small. */
export const parentCover = async (req: Request, res: Response): Promise<void> => {
    try {
        const cover = await activities.parentActivityCover(req.params.token, req.params.id);
        res.setHeader('Content-Type', cover.contentType);
        res.setHeader('Cache-Control', 'private, max-age=86400');
        res.status(200).send(cover.data);
    } catch (error) {
        if (error instanceof Error && error.name.startsWith('PrismaClient')) console.error(error);
        res.status(404).json({ success: false, error: 'Not found', message: 'Not found' });
    }
};
