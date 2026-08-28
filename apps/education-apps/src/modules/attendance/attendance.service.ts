import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';
import { deriveAttendanceStatus, TimeSlot } from '../../utils/attendanceStatus';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';
import { sendAttendanceNotification } from '../notifications/notification.service';

interface CreateAttendanceData {
    studentId: string;
    date: Date;
    status: string;
}

export const createAttendance = async (data: CreateAttendanceData) => {
    const { studentId, date, status } = data;

    if (!['PRESENT', 'LATE', 'ABSENT'].includes(status)) {
        throw new Error('Status must be one of PRESENT, LATE, ABSENT');
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
        throw new Error('Student not found');
    }

    const attendance = await prisma.attendance.create({
        data: { studentId, date, status: status as any },
        include: { student: true },
    });

    return attendance;
};

export const getAttendanceByStudent = async (studentId: string) => {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
        throw new Error('Student not found');
    }

    return prisma.attendance.findMany({
        where: { studentId },
        include: { student: true },
        orderBy: { date: 'desc' },
    });
};

export const scanAttendance = async (rawStudentToken: string, groupId: string) => {
    const accessTokenHash = hashToken(rawStudentToken);

    const student = await prisma.student.findUnique({
        where: { accessTokenHash },
    });

    if (!student) {
        throw new Error('Student not found');
    }

    if (!student.groupIds.includes(groupId)) {
        throw new Error('Student is not enrolled in this group');
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
        throw new Error('Group not found');
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await prisma.attendance.findUnique({
        where: {
            studentId_groupId_date: {
                studentId: student.id,
                groupId,
                date: today,
            },
        },
    });

    if (existing) {
        throw new Error('Attendance already marked for this session');
    }

    const status = deriveAttendanceStatus((group.timeSlots as unknown as TimeSlot[]) || [], now);

    let attendance;
    try {
        attendance = await prisma.attendance.create({
            data: {
                studentId: student.id,
                groupId,
                date: today,
                scannedAt: now,
                status: status as any,
            },
        });
    } catch (error) {
        if ((error as any)?.code === 'P2002') {
            throw new Error('Attendance already marked for this session');
        }
        throw error;
    }

    if (student.parentId) {
        const message = status === 'LATE'
            ? `Your child ${student.name} arrived late to class at ${now.toLocaleTimeString()}`
            : `Your child ${student.name} checked into class at ${now.toLocaleTimeString()}`;

        try {
            await sendAttendanceNotification(new ConsoleNotificationProvider(), {
                attendanceId: attendance.id,
                parentId: student.parentId,
                channel: 'WHATSAPP',
                message,
            });
        } catch (error) {
            console.error('[attendance] failed to send notification, attendance was still recorded:', error);
        }
    }

    return attendance;
};
