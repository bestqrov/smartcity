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
            parentId: input.parentId,
            channel: input.channel,
            message: input.message,
            status,
        },
    });
};
