import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import * as hw from './homework.service';

const scopeOf = (req: TenantRequest): hw.HomeworkScope => ({ branchId: req.branchId! });

export const list = (req: TenantRequest, res: Response) =>
    respond(res, () => hw.listGroupHomework(scopeOf(req), req.query.groupId), {
        message: 'Homework retrieved successfully',
        failure: 'Failed to retrieve homework',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(res, () => hw.createHomework(scopeOf(req), req.body || {}, req.user?.id ? `user:${req.user.id}` : undefined), {
        message: 'Homework created successfully',
        failure: 'Failed to create homework',
        status: 201,
    });

export const update = (req: TenantRequest, res: Response) =>
    respond(res, () => hw.updateHomework(scopeOf(req), req.params.id, req.body || {}), {
        message: 'Homework updated successfully',
        failure: 'Failed to update homework',
    });

export const remove = (req: TenantRequest, res: Response) =>
    respond(res, () => hw.deleteHomework(scopeOf(req), req.params.id), {
        message: 'Homework deleted successfully',
        failure: 'Failed to delete homework',
    });
