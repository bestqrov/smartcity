import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from './http';
import { recordTransportPayment, getDues } from './payments.service';

export const record = (req: TenantRequest, res: Response) =>
    respond(
        res,
        async () => {
            const raw = req.body.date;
            let date: Date | undefined;
            if (raw !== undefined && raw !== null && raw !== '') {
                date = new Date(raw);
                if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
            }
            return recordTransportPayment({
                subscriptionId: req.params.id,
                branchId: req.branchId!,
                forMonth: req.body.forMonth,
                amount: req.body.amount !== undefined && req.body.amount !== '' ? Number(req.body.amount) : undefined,
                method: req.body.method,
                note: req.body.note,
                date,
            });
        },
        { message: 'Transport payment recorded successfully', status: 201, failure: 'Failed to record payment' }
    );

export const dues = (req: TenantRequest, res: Response) =>
    respond(res, () => getDues(req.branchId!, (req.query.month as string | undefined) || undefined), {
        message: 'Dues retrieved successfully',
        failure: 'Failed to retrieve dues',
    });
