import { Request, Response } from 'express';
import { respond } from '../transport/http';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
    isReferralCodeValid,
    listAgents,
    createAgent,
    updateAgent,
    getAgentReport,
    getAgentReportForUser,
    recordPayout,
    deletePayout,
    updateOwnProfile,
    changeOwnPassword,
} from './salesAgents.service';
import {
    assignSchoolAgent,
    listSchoolPayments,
    recordSchoolPayment,
    deleteSchoolPayment,
} from './schoolPayments.service';

export const check = (req: Request, res: Response) =>
    respond(res, async () => ({ valid: await isReferralCodeValid(req.params.code) }), {
        message: 'Code checked',
        failure: 'Failed to check code',
    });

export const list = (_req: Request, res: Response) =>
    respond(res, () => listAgents(), { message: 'Sales agents retrieved', failure: 'Failed to retrieve sales agents' });

export const create = (req: Request, res: Response) =>
    respond(res, () => createAgent(req.body ?? {}), {
        message: 'Sales agent created',
        status: 201,
        failure: 'Failed to create sales agent',
    });

export const detail = (req: Request, res: Response) =>
    respond(res, () => getAgentReport(req.params.id), {
        message: 'Sales agent retrieved',
        failure: 'Failed to retrieve sales agent',
    });

export const update = (req: Request, res: Response) =>
    respond(res, () => updateAgent(req.params.id, req.body ?? {}), {
        message: 'Sales agent updated',
        failure: 'Failed to update sales agent',
    });

export const addPayout = (req: Request, res: Response) =>
    respond(res, () => recordPayout(req.params.id, req.body ?? {}), {
        message: 'Payout recorded',
        status: 201,
        failure: 'Failed to record payout',
    });

export const removePayout = (req: Request, res: Response) =>
    respond(res, () => deletePayout(req.params.id, req.params.payoutId), {
        message: 'Payout deleted',
        failure: 'Failed to delete payout',
    });

export const me = (req: AuthRequest, res: Response) =>
    respond(res, () => getAgentReportForUser(req.user!.id), {
        message: 'Agent dashboard retrieved',
        failure: 'Failed to retrieve agent dashboard',
    });

export const updateMe = (req: AuthRequest, res: Response) =>
    respond(res, () => updateOwnProfile(req.user!.id, req.body ?? {}), {
        message: 'Profile updated',
        failure: 'Failed to update profile',
    });

export const changeMyPassword = (req: AuthRequest, res: Response) =>
    respond(res, () => changeOwnPassword(req.user!.id, req.body ?? {}), {
        message: 'Password changed',
        failure: 'Failed to change password',
    });

export const assignAgent = (req: Request, res: Response) =>
    respond(res, () => assignSchoolAgent(req.params.id, req.body?.salesAgentId), {
        message: 'School sales agent updated',
        failure: 'Failed to update school sales agent',
    });

export const listPayments = (req: Request, res: Response) =>
    respond(res, () => listSchoolPayments(req.params.id), {
        message: 'School payments retrieved',
        failure: 'Failed to retrieve school payments',
    });

export const addPayment = (req: Request, res: Response) =>
    respond(res, () => recordSchoolPayment(req.params.id, req.body ?? {}), {
        message: 'School payment recorded',
        status: 201,
        failure: 'Failed to record school payment',
    });

export const removePayment = (req: Request, res: Response) =>
    respond(res, () => deleteSchoolPayment(req.params.id, req.params.paymentId), {
        message: 'School payment deleted',
        failure: 'Failed to delete school payment',
    });
