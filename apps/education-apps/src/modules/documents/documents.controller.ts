import { Response } from 'express';
import { getStudentsForDocuments, getStudentDocument } from './documents.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const getSoutienStudentsController = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const students = await getStudentsForDocuments(req.branchId!);
        sendSuccess(res, students, 'Students retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve students', 500);
    }
};

export const getStudentDocumentController = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const student = await getStudentDocument(id, req.branchId!);
        sendSuccess(res, student, 'Student document data retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve student document data', 404);
    }
};
