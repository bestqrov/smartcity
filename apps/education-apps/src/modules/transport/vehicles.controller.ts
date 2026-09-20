import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import { getAllVehicles, createVehicle, updateVehicle, deleteVehicle } from './vehicles.service';

export const getAll = (req: TenantRequest, res: Response) =>
    respond(res, () => getAllVehicles(req.branchId!), {
        message: 'Vehicles retrieved successfully',
        failure: 'Failed to retrieve vehicles',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () => createVehicle({ plate: req.body.plate, capacity: Number(req.body.capacity), branchId: req.branchId! }),
        { message: 'Vehicle created successfully', status: 201, failure: 'Failed to create vehicle' }
    );

export const update = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            updateVehicle(req.params.id, req.branchId!, {
                plate: req.body.plate,
                capacity: req.body.capacity !== undefined ? Number(req.body.capacity) : undefined,
                active: req.body.active,
            }),
        { message: 'Vehicle updated successfully', failure: 'Failed to update vehicle' }
    );

export const remove = (req: TenantRequest, res: Response) =>
    respond(res, async () => {
        await deleteVehicle(req.params.id, req.branchId!);
        return null;
    }, { message: 'Vehicle deleted successfully', failure: 'Failed to delete vehicle' });
