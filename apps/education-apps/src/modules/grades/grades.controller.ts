import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import * as grades from './grades.service';

const scopeOf = (req: TenantRequest): grades.GradesScope => ({ branchId: req.branchId! });

export const listEvaluations = (req: TenantRequest, res: Response) =>
    respond(res, () => grades.listGroupEvaluations(scopeOf(req), req.query.groupId as string), {
        message: 'Evaluations retrieved successfully',
        failure: 'Failed to retrieve evaluations',
    });

export const getPeriods = (req: TenantRequest, res: Response) =>
    respond(res, () => grades.periodsFor(req.branchId!), {
        message: 'Periods retrieved successfully',
        failure: 'Failed to retrieve periods',
    });

export const createEvaluation = (req: TenantRequest, res: Response) =>
    respond(res, () => grades.createEvaluation(scopeOf(req), req.body || {}, req.user?.id ? `user:${req.user.id}` : undefined), {
        message: 'Evaluation created successfully',
        failure: 'Failed to create evaluation',
        status: 201,
    });

export const updateEvaluation = (req: TenantRequest, res: Response) =>
    respond(res, () => grades.updateEvaluation(scopeOf(req), req.params.id, req.body || {}), {
        message: 'Evaluation updated successfully',
        failure: 'Failed to update evaluation',
    });

export const deleteEvaluation = (req: TenantRequest, res: Response) =>
    respond(res, () => grades.deleteEvaluation(scopeOf(req), req.params.id), {
        message: 'Evaluation deleted successfully',
        failure: 'Failed to delete evaluation',
    });

export const saveGrades = (req: TenantRequest, res: Response) =>
    respond(res, () => grades.saveGrades(scopeOf(req), req.params.id, req.body?.grades), {
        message: 'Grades saved successfully',
        failure: 'Failed to save grades',
    });

export const publish = (req: TenantRequest, res: Response) =>
    respond(res, () => grades.setPublished(scopeOf(req), req.params.id, req.body?.published), {
        message: 'Evaluation updated successfully',
        failure: 'Failed to publish evaluation',
    });

export const getBulletin = (req: TenantRequest, res: Response) =>
    respond(res, () => grades.bulletin(scopeOf(req), req.query.groupId as string, req.query.period as string), {
        message: 'Bulletin retrieved successfully',
        failure: 'Failed to retrieve bulletin',
    });
