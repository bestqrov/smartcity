import { Request, Response } from 'express';
import {
    createInscription,
    getAllInscriptions,
    getInscriptionById,
    updateInscription,
    deleteInscription,
    getInscriptionAnalytics,
} from './inscriptions.service';
import { sendSuccess, sendError } from '../../utils/response';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { studentId, type, category, amount, date, note } = req.body;

        // Validate required fields
        if (!studentId || !type || !category || amount === undefined) {
            sendError(
                res,
                'StudentId, type, category, and amount are required',
                'Validation error',
                400
            );
            return;
        }

        if (!['SOUTIEN', 'FORMATION'].includes(type)) {
            sendError(res, 'Invalid type', 'Type must be SOUTIEN or FORMATION', 400);
            return;
        }

        const inscriptionData: any = { studentId, type, category, amount };
        if (date) inscriptionData.date = new Date(date);
        if (note) inscriptionData.note = note;

        const inscription = await createInscription(inscriptionData);

        sendSuccess(res, inscription, 'Inscription created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create inscription', 400);
    }
};

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const inscriptions = await getAllInscriptions();
        sendSuccess(res, inscriptions, 'Inscriptions retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve inscriptions', 500);
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const inscription = await getInscriptionById(id);
        sendSuccess(res, inscription, 'Inscription retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve inscription', 404);
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { type, category, amount, date, note } = req.body;

        if (type && !['SOUTIEN', 'FORMATION'].includes(type)) {
            sendError(res, 'Invalid type', 'Type must be SOUTIEN or FORMATION', 400);
            return;
        }

        const updateData: any = {};
        if (type) updateData.type = type;
        if (category) updateData.category = category;
        if (amount !== undefined) updateData.amount = amount;
        if (date) updateData.date = new Date(date);
        if (note !== undefined) updateData.note = note;

        const inscription = await updateInscription(id, updateData);

        sendSuccess(res, inscription, 'Inscription updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update inscription', 400);
    }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await deleteInscription(id);
        sendSuccess(res, result, 'Inscription deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete inscription', 404);
    }
};

export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const analytics = await getInscriptionAnalytics();
        sendSuccess(res, analytics, 'Analytics retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve analytics', 500);
    }
};

