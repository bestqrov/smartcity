import { Response } from 'express';
import {
    getAttendanceByStudent,
    getWeeklyAttendance,
    markAttendance,
    markSession,
    scanAttendance,
} from './attendance.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

export const getByStudent = async (
    req: TenantRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const attendances = await getAttendanceByStudent(id, req.branchId!);
        sendSuccess(res, attendances, 'Attendance retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve attendance', 404);
    }
};

export const scan = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { studentToken, groupId } = req.body;

        if (!studentToken || !groupId) {
            sendError(res, 'studentToken and groupId are required', 'Validation error', 400);
            return;
        }

        const attendance = await scanAttendance(studentToken, groupId, req.branchId!);
        sendSuccess(res, attendance, 'Attendance recorded', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to record attendance', 400);
    }
};

export const week = async (req: TenantRequest, res: Response): Promise<void> => {
    const groupId = typeof req.query.groupId === 'string' ? req.query.groupId : '';
    const weekOf = typeof req.query.weekOf === 'string' ? req.query.weekOf : '';

    if (!groupId || !weekOf) {
        sendError(res, 'groupId and weekOf are required', 'Validation error', 400);
        return;
    }

    try {
        const data = await getWeeklyAttendance(groupId, weekOf, req.branchId!);
        sendSuccess(res, data, 'Weekly attendance retrieved', 200);
    } catch (error: any) {
        const status = error.message === 'Group not found' ? 404 : 400;
        sendError(res, error.message, 'Failed to retrieve weekly attendance', status);
    }
};

export const mark = async (req: TenantRequest, res: Response): Promise<void> => {
    const { studentId, groupId, date, slotStart, status, note } = req.body || {};

    if (!studentId || !groupId || !date || !slotStart || !status) {
        sendError(res, 'studentId, groupId, date, slotStart and status are required', 'Validation error', 400);
        return;
    }
    if (note != null && typeof note !== 'string') {
        sendError(res, 'note must be text', 'Validation error', 400);
        return;
    }

    try {
        const attendance = await markAttendance({
            studentId,
            groupId,
            date,
            slotStart,
            status,
            note,
            branchId: req.branchId!,
            userId: req.user?.id,
        });
        sendSuccess(res, attendance, 'Attendance saved', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to save attendance', 400);
    }
};

export const markWholeSession = async (req: TenantRequest, res: Response): Promise<void> => {
    const { groupId, date, slotStart, entries } = req.body || {};

    if (!groupId || !date || !slotStart || !Array.isArray(entries)) {
        sendError(res, 'groupId, date, slotStart and entries are required', 'Validation error', 400);
        return;
    }
    if (entries.some((e: any) => !e || typeof e !== 'object' || (e.note != null && typeof e.note !== 'string'))) {
        sendError(res, 'Each entry needs studentId, status and an optional text note', 'Validation error', 400);
        return;
    }

    try {
        const saved = await markSession({
            groupId,
            date,
            slotStart,
            entries,
            branchId: req.branchId!,
            userId: req.user?.id,
        });
        sendSuccess(res, saved, 'Session attendance saved', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to save attendance', 400);
    }
};
