import { Request, Response } from 'express';
import {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getSecretaries,
    updateSecretary,
} from './users.service';
import { sendSuccess, sendError } from '../../utils/response';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, name, role } = req.body;

        // Validate input
        if (!email || !password || !name || !role) {
            sendError(res, 'All fields are required', 'Validation error', 400);
            return;
        }

        if (!['ADMIN', 'SECRETARY'].includes(role)) {
            sendError(res, 'Invalid role', 'Role must be ADMIN or SECRETARY', 400);
            return;
        }

        const user = await createUser({ email, password, name, role });

        sendSuccess(res, user, 'User created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create user', 400);
    }
};

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await getAllUsers();
        sendSuccess(res, users, 'Users retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve users', 500);
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await getUserById(id);
        sendSuccess(res, user, 'User retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve user', 404);
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { email, password, name, role } = req.body;

        if (role && !['ADMIN', 'SECRETARY'].includes(role)) {
            sendError(res, 'Invalid role', 'Role must be ADMIN or SECRETARY', 400);
            return;
        }

        const user = await updateUser(id, { email, password, name, role });

        sendSuccess(res, user, 'User updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update user', 400);
    }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await deleteUser(id);
        sendSuccess(res, result, 'User deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete user', 404);
    }
};

// Secretary-specific controllers
export const getSecretariesController = async (req: Request, res: Response): Promise<void> => {
    try {
        const secretaries = await getSecretaries();
        sendSuccess(res, secretaries, 'Secretaries retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve secretaries', 500);
    }
};

export const updateSecretaryController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { email, password, name, gsm, whatsapp, address, schoolLevel, certification } = req.body;

        const secretary = await updateSecretary(id, {
            email,
            password,
            name,
            gsm,
            whatsapp,
            address,
            schoolLevel,
            certification
        });

        sendSuccess(res, secretary, 'Secretary updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update secretary', 400);
    }
};

