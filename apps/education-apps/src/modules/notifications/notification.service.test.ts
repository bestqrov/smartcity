import { sendAttendanceNotification } from './notification.service';
import { NotificationProvider } from './notification.provider';
import prisma from '../../config/database';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        attendance: { findUnique: jest.fn() },
        attendanceNotification: { create: jest.fn() },
    },
}));

describe('sendAttendanceNotification', () => {
    afterEach(() => jest.clearAllMocks());

    it('throws when the attendanceId does not resolve to a real Attendance row', async () => {
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValue(null);
        const fakeProvider: NotificationProvider = { send: jest.fn() };

        await expect(
            sendAttendanceNotification(fakeProvider, {
                attendanceId: 'missing',
                parentId: 'parent1',
                channel: 'WHATSAPP',
                message: 'Your child checked in',
            })
        ).rejects.toThrow('Attendance not found');
    });

    it('sends via the provider and records a SENT AttendanceNotification stamped with the attendance\'s branchId', async () => {
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValue({ id: 'att1', branchId: 'b1' });
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
                branchId: 'b1',
                parentId: 'parent1',
                channel: 'WHATSAPP',
                message: 'Your child checked in',
                status: 'SENT',
            },
        });
    });

    it('records FAILED when the provider throws', async () => {
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValue({ id: 'att1', branchId: 'b1' });
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
            data: expect.objectContaining({ status: 'FAILED', branchId: 'b1' }),
        });
    });
});
