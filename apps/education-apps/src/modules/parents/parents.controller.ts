import { Request, Response } from 'express';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';
import prisma from '../../config/database';
import {
    createParent,
    getAllParents,
    getParentById,
    updateParent,
    regenerateParentToken,
    getParentByRawToken,
    issueParentLinks,
    getParentsAccess,
} from './parents.service';
import { sendSuccess, sendError } from '../../utils/response';
import { listInbox, markRead } from '../notifications/inbox.service';
import { respond } from '../transport/http';

export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { name, phone, whatsapp, email, cin, address } = req.body;

        if (!name || !phone) {
            sendError(res, 'name and phone are required', 'Validation error', 400);
            return;
        }

        const { parent, rawToken } = await createParent({ name, phone, whatsapp, email, cin, address, branchId: req.branchId! });
        sendSuccess(res, { parent: stripTokenHashes(parent), rawToken }, 'Parent created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create parent', 400);
    }
};

const stripTokenHashes = (parent: any) => {
    const { accessTokenHash, students, ...safeParent } = parent;

    if (!students) {
        return safeParent;
    }

    const safeStudents = students.map(({ accessTokenHash, portalTokenHash, ...student }: any) => student);
    return { ...safeParent, students: safeStudents };
};

export const getAll = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const parents = await getAllParents(req.branchId!);
        sendSuccess(res, parents.map(stripTokenHashes), 'Parents retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve parents', 400);
    }
};

export const getById = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const parent = await getParentById(req.params.id, req.branchId!);
        sendSuccess(res, stripTokenHashes(parent), 'Parent retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve parent', 404);
    }
};

export const update = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const parent = await updateParent(req.params.id, req.branchId!, req.body || {});
        sendSuccess(res, stripTokenHashes(parent), 'Parent updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update parent', 400);
    }
};

export const regenerateToken = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { parent, rawToken } = await regenerateParentToken(req.params.id, req.branchId!);
        sendSuccess(res, { parent: stripTokenHashes(parent), rawToken }, 'Token regenerated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to regenerate token', 400);
    }
};

export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const parent = await getParentByRawToken(req.params.token);

        if (!parent) {
            sendError(res, 'Not found', 'Not found', 404);
            return;
        }

        await prisma.accessLog.create({
            data: { parentId: parent.id, ip: req.ip },
        });

        sendSuccess(res, stripTokenHashes(parent), 'Profile retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, 'Not found', 'Not found', 404);
    }
};

export const issueLinks = async (req: TenantRequest, res: Response): Promise<void> => {
    await respond(res, () => issueParentLinks(req.body?.parentIds, req.branchId!), {
        message: 'Links issued successfully',
        failure: 'Failed to issue links',
    });
};

export const getAccess = async (req: TenantRequest, res: Response): Promise<void> => {
    await respond(res, () => getParentsAccess(req.branchId!), {
        message: 'Parents access retrieved successfully',
        failure: 'Failed to retrieve parents access',
    });
};

const inboxFail = (res: Response, error: any) => {
    const status = error?.message === 'Parent not found' ? 404 : 400;
    sendError(res, error?.message || 'Failed', 'Failed', status);
};

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await listInbox(req.params.token, req.query.before, req.query.limit);
        sendSuccess(res, data, 'Notifications retrieved successfully', 200);
    } catch (error: any) {
        inboxFail(res, error);
    }
};

export const readNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await markRead(req.params.token, req.body?.ids);
        sendSuccess(res, data, 'Notifications marked as read', 200);
    } catch (error: any) {
        inboxFail(res, error);
    }
};
