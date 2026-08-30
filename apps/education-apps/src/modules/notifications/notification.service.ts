import prisma from '../../config/database';
import { NotificationProvider } from './notification.provider';

interface SendAttendanceNotificationInput {
    attendanceId: string;
    parentId: string;
    channel: 'WHATSAPP' | 'SMS' | 'PUSH';
    message: string;
}

export const sendAttendanceNotification = async (
    provider: NotificationProvider,
    input: SendAttendanceNotificationInput
): Promise<void> => {
    const attendance = await prisma.attendance.findUnique({ where: { id: input.attendanceId } });
    if (!attendance) {
        throw new Error('Attendance not found');
    }

    let status: 'SENT' | 'FAILED' = 'SENT';

    try {
        await provider.send(input.parentId, input.message);
    } catch (error) {
        console.error('[notification] failed to send:', error);
        status = 'FAILED';
    }

    await prisma.attendanceNotification.create({
        data: {
            attendanceId: input.attendanceId,
            branchId: attendance.branchId,
            parentId: input.parentId,
            channel: input.channel,
            message: input.message,
            status,
        },
    });
};
