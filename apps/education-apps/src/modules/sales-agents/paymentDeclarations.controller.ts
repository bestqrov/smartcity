import { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import type { SalesAgentRequest } from '../../middlewares/salesAgent.middleware';
import { respond } from '../transport/http';
import {
    confirmDeclaration,
    countPendingDeclarations,
    declarePayment,
    getDeclaration,
    listAgentDeclarations,
    listDeclarations,
    rejectDeclaration,
} from './paymentDeclarations.service';

// ---- sales agent
export const declare = (req: SalesAgentRequest, res: Response) =>
    respond(res, () => declarePayment(req.salesAgent!.id, req.body ?? {}), {
        message: 'Payment declared',
        failure: 'Failed to declare the payment',
        status: 201,
    });

export const listMine = (req: SalesAgentRequest, res: Response) =>
    respond(res, () => listAgentDeclarations(req.salesAgent!.id), {
        message: 'Payment declarations retrieved',
        failure: 'Failed to retrieve payment declarations',
    });

// ---- super admin
export const list = (req: AuthRequest, res: Response) =>
    respond(res, () => listDeclarations(req.query.status), {
        message: 'Payment declarations retrieved',
        failure: 'Failed to retrieve payment declarations',
    });

export const pendingCount = (_req: AuthRequest, res: Response) =>
    respond(res, async () => ({ pending: await countPendingDeclarations() }), {
        message: 'Pending declarations counted',
        failure: 'Failed to count pending declarations',
    });

export const getOne = (req: AuthRequest, res: Response) =>
    respond(res, () => getDeclaration(req.params.id), {
        message: 'Payment declaration retrieved',
        failure: 'Failed to retrieve the payment declaration',
    });

export const confirm = (req: AuthRequest, res: Response) =>
    respond(res, () => confirmDeclaration(req.params.id, req.user!.id, req.body ?? {}), {
        message: 'Payment confirmed',
        failure: 'Failed to confirm the payment',
    });

export const reject = (req: AuthRequest, res: Response) =>
    respond(res, () => rejectDeclaration(req.params.id, req.user!.id, req.body?.reason), {
        message: 'Payment declaration rejected',
        failure: 'Failed to reject the payment declaration',
    });
