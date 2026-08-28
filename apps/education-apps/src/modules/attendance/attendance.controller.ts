import { Request, Response } from 'express';
import {
    createAttendance,
    getAttendanceByStudent,
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

        if (!['present', 'absent'].includes(status)) {
            sendError(
                res,
                'Invalid status',
                'Status must be "present" or "absent"',
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
