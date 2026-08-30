import { Response } from 'express';
import * as teachersService from './teachers.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const createTeacher = async (req: TenantRequest, res: Response) => {
    try {
        const teacher = await teachersService.createTeacher({ ...req.body, branchId: req.branchId! });
        sendSuccess(res, teacher, 'Teacher created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create teacher', 400);
    }
};

export const getAllTeachers = async (req: TenantRequest, res: Response) => {
    try {
        const teachers = await teachersService.getAllTeachers(req.branchId!);
        sendSuccess(res, teachers, 'Teachers retrieved successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve teachers');
    }
};

export const updateTeacher = async (req: TenantRequest, res: Response) => {
    try {
        const teacher = await teachersService.updateTeacher(req.params.id, req.branchId!, req.body);
        sendSuccess(res, teacher, 'Teacher updated successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update teacher', 400);
    }
};

export const deleteTeacher = async (req: TenantRequest, res: Response) => {
    try {
        await teachersService.deleteTeacher(req.params.id, req.branchId!);
        sendSuccess(res, null, 'Teacher deleted successfully');
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete teacher', 400);
    }
};
