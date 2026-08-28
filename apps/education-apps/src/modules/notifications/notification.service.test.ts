import { sendAttendanceNotification } from './notification.service';
import { NotificationProvider } from './notification.provider';
import prisma from '../../config/database';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        attendanceNotification: { create: jest.fn() },
    },
}));

describe('sendAttendanceNotification', () => {
    it('sends via the provider and records a SENT AttendanceNotification', async () => {
        const fakeProvider: NotificationProvider = {
            send: jest.fn().mockResolvedValue(undefined),
        };
        (prisma.attendanceNotification.create as jest.Mock).mockResolvedValue({});

        await sendAttendanceNotification(fakeProvider, {
            attendanceId: 'att1',
            parentId: 'parent1',
            channel: 'WHATSAPP',
            message: 'Your child checked in',
        });

        expect(fakeProvider.send).toHaveBeenCalledWith('parent1', 'Your child checked in');
        expect(prisma.attendanceNotification.create).toHaveBeenCalledWith({
            data: {
                attendanceId: 'att1',
                parentId: 'parent1',
                channel: 'WHATSAPP',
                message: 'Your child checked in',
                status: 'SENT',
            },
        });
    });

    it('records FAILED when the provider throws', async () => {
        const fakeProvider: NotificationProvider = {
            send: jest.fn().mockRejectedValue(new Error('provider down')),
        };
        (prisma.attendanceNotification.create as jest.Mock).mockResolvedValue({});

        await sendAttendanceNotification(fakeProvider, {
            attendanceId: 'att1',
            parentId: 'parent1',
            channel: 'WHATSAPP',
            message: 'Your child checked in',
        });

        expect(prisma.attendanceNotification.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ status: 'FAILED' }),
        });
    });
});
