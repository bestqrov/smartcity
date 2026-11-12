import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import { getSchoolCapacity, remainingPlaces } from '../packs/packs.limits';
import { addOneMonth, getPendingUpgrades, upgradeSchoolPack } from './packUpgrade.service';

// The school is always the caller's own: tenantScope sets req.branchId, nothing is read from the body.
export const capacity = (req: TenantRequest, res: Response) =>
    respond(
        res,
        async () => {
            const result = await getSchoolCapacity(req.branchId!);
            return {
                institutionType: result.institutionType,
                status: result.status,
                packCode: result.packCode,
                packName: result.packName,
                limit: result.limit,
                current: result.current,
                remaining: remainingPlaces(result),
                // The deadline an upgrade made now would get, shown before the admin confirms.
                upgradeDueAt: result.status === 'PENDING' ? null : addOneMonth(new Date()),
            };
        },
        { message: 'School capacity', failure: 'Failed to load school capacity' }
    );

export const upgrade = (req: TenantRequest, res: Response) =>
    respond(res, () => upgradeSchoolPack(req.branchId!, req.user!.id, req.body?.packCode), {
        message: 'Pack upgraded',
        failure: 'Failed to upgrade pack',
    });

export const pending = (req: TenantRequest, res: Response) =>
    respond(res, () => getPendingUpgrades(req.branchId!), {
        message: 'Pending upgrades',
        failure: 'Failed to load pending upgrades',
    });
