import { Request, Response } from 'express';
import {
    createAttendance,
    getAttendanceByStudent,
    scanAttendance,
} from './attendance.service';
import { sendSuccess, sendError } from '../../utils/response';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { studentId, date, status } = req.body;

        // Validate required fields
        if (!studentId || !date || !status) {
            sendError(
                res,
                'StudentId, date, and status are required',
                'Validation error',
                400
            );
            return;
        }

        if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) {
            sendError(
                res,
                'Invalid status',
                'Status must be one of PRESENT, LATE, ABSENT',
                400
            );
            return;
        }

        const attendance = await createAttendance({
            studentId,
            date: new Date(date),
            status,
        });

        sendSuccess(res, attendance, 'Attendance created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create attendance', 400);
    }
};

export const getByStudent = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const attendances = await getAttendanceByStudent(id);
        sendSuccess(res, attendances, 'Attendance retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve attendance', 404);
    }
};

export const scan = async (req: Request, res: Response): Promise<void> => {
    try {
        const { studentToken, groupId } = req.body;

        if (!studentToken || !groupId) {
            sendError(res, 'studentToken and groupId are required', 'Validation error', 400);
            return;
        }

        const attendance = await scanAttendance(studentToken, groupId);
        sendSuccess(res, attendance, 'Attendance recorded', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to record attendance', 400);
    }
};
