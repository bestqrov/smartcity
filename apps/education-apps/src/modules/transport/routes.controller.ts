import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import {
    getAllRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    createStop,
    updateStop,
    deleteStop,
} from './routes.service';

const optionalNumber = (value: unknown) =>
    value === undefined ? undefined : value === null || value === '' ? null : Number(value);

export const getAll = (req: TenantRequest, res: Response) =>
    respond(res, () => getAllRoutes(req.branchId!), {
        message: 'Routes retrieved successfully',
        failure: 'Failed to retrieve routes',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            createRoute({
                name: req.body.name,
                vehicleId: req.body.vehicleId,
                driverId: req.body.driverId,
                monthlyPrice: optionalNumber(req.body.monthlyPrice),
                branchId: req.branchId!,
            }),
        { message: 'Route created successfully', status: 201, failure: 'Failed to create route' }
    );

export const update = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            updateRoute(req.params.id, req.branchId!, {
                name: req.body.name,
                vehicleId: req.body.vehicleId,
                driverId: req.body.driverId,
                monthlyPrice: optionalNumber(req.body.monthlyPrice),
                active: req.body.active,
            }),
        { message: 'Route updated successfully', failure: 'Failed to update route' }
    );

export const remove = (req: TenantRequest, res: Response) =>
    respond(res, async () => {
        await deleteRoute(req.params.id, req.branchId!);
        return null;
    }, { message: 'Route deleted successfully', failure: 'Failed to delete route' });

export const addStop = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            createStop(req.params.id, req.branchId!, {
                name: req.body.name,
                order: Number(req.body.order),
                morningTime: req.body.morningTime,
                afternoonTime: req.body.afternoonTime,
                monthlyPrice: optionalNumber(req.body.monthlyPrice),
            }),
        { message: 'Stop created successfully', status: 201, failure: 'Failed to create stop' }
    );

export const editStop = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            updateStop(req.params.id, req.params.stopId, req.branchId!, {
                name: req.body.name,
                order: req.body.order !== undefined ? Number(req.body.order) : undefined,
                morningTime: req.body.morningTime,
                afternoonTime: req.body.afternoonTime,
                monthlyPrice: optionalNumber(req.body.monthlyPrice),
            }),
        { message: 'Stop updated successfully', failure: 'Failed to update stop' }
    );

export const removeStop = (req: TenantRequest, res: Response) =>
    respond(res, async () => {
        await deleteStop(req.params.id, req.params.stopId, req.branchId!);
        return null;
    }, { message: 'Stop deleted successfully', failure: 'Failed to delete stop' });
