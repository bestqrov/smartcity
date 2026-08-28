import { Request, Response } from 'express';
import prisma from '../../config/database';
import {
    createParent,
    getAllParents,
    getParentById,
    updateParent,
    regenerateParentToken,
    getParentByRawToken,
} from './parents.service';
import { sendSuccess, sendError } from '../../utils/response';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, phone, whatsapp, email, cin, address } = req.body;

        if (!name || !phone) {
            sendError(res, 'name and phone are required', 'Validation error', 400);
            return;
        }

        const { parent, rawToken } = await createParent({ name, phone, whatsapp, email, cin, address });
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

    const safeStudents = students.map(({ accessTokenHash, ...student }: any) => student);
    return { ...safeParent, students: safeStudents };
};

export const getAll = async (_req: Request, res: Response): Promise<void> => {
    try {
        const parents = await getAllParents();
        sendSuccess(res, parents.map(stripTokenHashes), 'Parents retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve parents', 400);
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const parent = await getParentById(req.params.id);
        sendSuccess(res, stripTokenHashes(parent), 'Parent retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve parent', 404);
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const parent = await updateParent(req.params.id, req.body);
        sendSuccess(res, stripTokenHashes(parent), 'Parent updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update parent', 400);
    }
};

export const regenerateToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const { parent, rawToken } = await regenerateParentToken(req.params.id);
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
