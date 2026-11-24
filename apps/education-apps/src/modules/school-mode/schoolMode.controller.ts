import { Response } from 'express';
import type { TenantRequest } from '../../middlewares/tenantScope.middleware';
import { respond } from '../transport/http';
import { collectMonth, listDues } from './dues.service';
import { registerSchoolStudent } from './inscription.service';
import { getTuitionGrid, saveTuitionGrid } from './tuitionFees.service';

export const getGrid = (req: TenantRequest, res: Response) =>
    respond(res, () => getTuitionGrid(req.branchId!), { message: 'Tuition fees retrieved', failure: 'Failed to retrieve tuition fees' });
export const saveGrid = (req: TenantRequest, res: Response) =>
    respond(res, () => saveTuitionGrid(req.branchId!, req.body?.items), { message: 'Tuition fees saved', failure: 'Failed to save tuition fees' });
export const register = (req: TenantRequest, res: Response) =>
    respond(res, () => registerSchoolStudent(req.branchId!, req.body ?? {}), { message: 'Student registered', failure: 'Failed to register the student', status: 201 });
export const dues = (req: TenantRequest, res: Response) =>
    respond(res, () => listDues(req.branchId!, String(req.query.month ?? '')), { message: 'Dues retrieved', failure: 'Failed to retrieve dues' });
export const collect = (req: TenantRequest, res: Response) =>
    respond(res, () => collectMonth(req.branchId!, req.body ?? {}), { message: 'Payment recorded', failure: 'Failed to record the payment', status: 201 });
