import prisma from '../../config/database';
import { scanAttendance } from './attendance.service';
import * as accessToken from '../../utils/accessToken';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        group: { findUnique: jest.fn() },
        attendance: { findUnique: jest.fn(), create: jest.fn() },
        attendanceNotification: { create: jest.fn() },
    },
}));

jest.mock('../notifications/notification.provider', () => ({
    ConsoleNotificationProvider: jest.fn().mockImplementation(() => ({
        send: jest.fn().mockResolvedValue(undefined),
    })),
}));

// 2026-08-31 is a Monday
const MONDAY_9AM = new Date(2026, 7, 31, 9, 0, 0);

describe('scanAttendance', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(MONDAY_9AM);
        jest.clearAllMocks();
    });

    afterEach(() => jest.useRealTimers());

    it('throws when the token matches no student', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(scanAttendance('bad-token', 'group1')).rejects.toThrow('Student not found');
    });

    it('throws when the student is not enrolled in the given group', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            groupIds: ['other-group'],
        });

        await expect(scanAttendance('tok', 'group1')).rejects.toThrow('Student is not enrolled in this group');
    });

    it('creates a PRESENT attendance and rejects a second scan for the same session', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce(null);
        (prisma.attendance.create as jest.Mock).mockResolvedValue({ id: 'att1', status: 'PRESENT' });

        const result = await scanAttendance('tok', 'group1');
        expect(result.status).toBe('PRESENT');

        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'att1' });
        await expect(scanAttendance('tok', 'group1')).rejects.toThrow('Attendance already marked for this session');
    });

    it('translates a P2002 unique-constraint race into the friendly duplicate-scan message', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        // Passes the pre-check (no existing row seen yet), but the DB rejects the
        // create with a unique-constraint violation because another scan won the race.
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce(null);
        (prisma.attendance.create as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error('Unique constraint failed on the fields: (`studentId`,`groupId`,`date`)'), {
                code: 'P2002',
                name: 'PrismaClientKnownRequestError',
            })
        );

        await expect(scanAttendance('tok', 'group1')).rejects.toThrow('Attendance already marked for this session');
    });
});
