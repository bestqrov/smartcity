import prisma from '../../config/database';
import { scanAttendance, createAttendance, getAttendanceByStudent } from './attendance.service';
import * as accessToken from '../../utils/accessToken';
import { ConsoleNotificationProvider } from '../notifications/notification.provider';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        group: { findUnique: jest.fn() },
        attendance: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
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

        await expect(scanAttendance('bad-token', 'group1', 'b1')).rejects.toThrow('Student not found');
    });

    it('throws when the student belongs to a different branch than the scanning device', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'other-branch',
            groupIds: ['group1'],
        });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Student not found');
    });

    it('throws when the student is not enrolled in the given group', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'b1',
            groupIds: ['other-group'],
        });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Student is not enrolled in this group');
    });

    it('throws when the group belongs to a different branch than the scanning device', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'b1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            branchId: 'other-branch',
            timeSlots: [],
        });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Group not found');
    });

    it('creates a PRESENT attendance stamped with the scanning branch, and rejects a second scan for the same session', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'b1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            branchId: 'b1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce(null);
        (prisma.attendance.create as jest.Mock).mockResolvedValue({ id: 'att1', status: 'PRESENT' });

        const result = await scanAttendance('tok', 'group1', 'b1');
        expect(result.status).toBe('PRESENT');
        expect(prisma.attendance.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );

        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'att1' });
        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Attendance already marked for this session');
    });

    it('translates a P2002 unique-constraint race into the friendly duplicate-scan message', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({
            id: 's1',
            accessTokenHash: accessToken.hashToken('tok'),
            parentId: 'p1',
            branchId: 'b1',
            groupIds: ['group1'],
        });
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            branchId: 'b1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.findUnique as jest.Mock).mockResolvedValueOnce(null);
        (prisma.attendance.create as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error('Unique constraint failed on the fields: (`studentId`,`groupId`,`date`)'), {
                code: 'P2002',
                name: 'PrismaClientKnownRequestError',
            })
        );

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Attendance already marked for this session');
    });
});

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createAttendance throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(
            createAttendance({ studentId: 's1', date: new Date(), status: 'PRESENT', branchId: 'b1' } as any)
        ).rejects.toThrow('Student not found');
    });

    it('createAttendance stamps branchId from the given value when the student matches', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.attendance.create as jest.Mock).mockResolvedValue({ id: 'a1', branchId: 'b1' });

        await createAttendance({ studentId: 's1', date: new Date(), status: 'PRESENT', branchId: 'b1' } as any);

        expect(prisma.attendance.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAttendanceByStudent throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(getAttendanceByStudent('s1', 'b1')).rejects.toThrow('Student not found');
    });

    it('getAttendanceByStudent filters attendance by branchId', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);

        await getAttendanceByStudent('s1', 'b1');

        expect(prisma.attendance.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { studentId: 's1', branchId: 'b1' } })
        );
    });
});
