import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import { getAllDrivers, createDriver, updateDriver, deleteDriver } from './drivers.service';

export const getAll = (req: TenantRequest, res: Response) =>
    respond(res, () => getAllDrivers(req.branchId!), {
        message: 'Drivers retrieved successfully',
        failure: 'Failed to retrieve drivers',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () => createDriver({ name: req.body.name, phone: req.body.phone, branchId: req.branchId! }),
        { message: 'Driver created successfully', status: 201, failure: 'Failed to create driver' }
    );

export const update = (req: TenantRequest, res: Response) =>
    respond(
        res,
        () =>
            updateDriver(req.params.id, req.branchId!, {
                name: req.body.name,
                phone: req.body.phone,
                active: req.body.active,
            }),
        { message: 'Driver updated successfully', failure: 'Failed to update driver' }
    );

export const remove = (req: TenantRequest, res: Response) =>
    respond(res, async () => {
        await deleteDriver(req.params.id, req.branchId!);
        return null;
    }, { message: 'Driver deleted successfully', failure: 'Failed to delete driver' });
