import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import {
    createSubscription,
    pauseSubscription,
    resumeSubscription,
    endSubscription,
    listSubscriptions,
    getOpenSubscriptionForStudent,
} from './subscriptions.service';

const STATUSES = ['ACTIVE', 'PAUSED', 'ENDED'];

export const getAll = (req: TenantRequest, res: Response) =>
    respond(
        res,
        async () => {
            const status = req.query.status as string | undefined;
            if (status !== undefined && !STATUSES.includes(status)) throw new Error('Invalid status');
            return listSubscriptions(req.branchId!, status as 'ACTIVE' | 'PAUSED' | 'ENDED' | undefined);
        },
        { message: 'Subscriptions retrieved successfully', failure: 'Failed to retrieve subscriptions' }
    );

export const getForStudent = (req: TenantRequest, res: Response) =>
    respond(res, () => getOpenSubscriptionForStudent(req.params.studentId, req.branchId!), {
        message: 'Subscription retrieved successfully',
        failure: 'Failed to retrieve subscription',
    });

export const create = (req: TenantRequest, res: Response) =>
    respond(
        res,
        async () => {
            const raw = req.body.startDate;
            let startDate: Date | undefined;
            if (raw !== undefined && raw !== null && raw !== '') {
                startDate = new Date(raw);
                if (Number.isNaN(startDate.getTime())) throw new Error('Invalid start date');
            }
            return createSubscription({
                studentId: req.body.studentId,
                routeId: req.body.routeId,
                stopId: req.body.stopId,
                startDate,
                branchId: req.branchId!,
            });
        },
        { message: 'Subscription created successfully', status: 201, failure: 'Failed to create subscription' }
    );

export const pause = (req: TenantRequest, res: Response) =>
    respond(res, () => pauseSubscription(req.params.id, req.branchId!), {
        message: 'Subscription paused successfully',
        failure: 'Failed to pause subscription',
    });

export const resume = (req: TenantRequest, res: Response) =>
    respond(res, () => resumeSubscription(req.params.id, req.branchId!), {
        message: 'Subscription resumed successfully',
        failure: 'Failed to resume subscription',
    });

export const end = (req: TenantRequest, res: Response) =>
    respond(res, () => endSubscription(req.params.id, req.branchId!), {
        message: 'Subscription ended successfully',
        failure: 'Failed to end subscription',
    });
