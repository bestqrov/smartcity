import { Request, Response } from 'express';
import { getStudentsForDocuments, getStudentDocument } from './documents.service';
import { sendSuccess, sendError } from '../../utils/response';

export const getSoutienStudentsController = async (req: Request, res: Response): Promise<void> => {
    try {
        const students = await getStudentsForDocuments();
        sendSuccess(res, students, 'Students retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve students', 500);
    }
};

export const getStudentDocumentController = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const student = await getStudentDocument(id);
        sendSuccess(res, student, 'Student document data retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve student document data', 404);
    }
};
