import prisma from '../../config/database';
import {
    scanAttendance,
    getAttendanceByStudent,
    getWeeklyAttendance,
    markAttendance,
    markSession,
    findSessionRecord,
} from './attendance.service';
import * as accessToken from '../../utils/accessToken';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        group: { findUnique: jest.fn() },
        holiday: { findMany: jest.fn() },
        attendance: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
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

const enrolledStudent = {
    id: 's1',
    name: 'Sara',
    surname: 'Bennani',
    accessTokenHash: accessToken.hashToken('tok'),
    parentId: 'p1',
    branchId: 'b1',
    groupIds: ['group1'],
};

describe('scanAttendance', () => {
    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(MONDAY_9AM);
        jest.clearAllMocks();
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);
    });

    afterEach(() => jest.useRealTimers());

    it('throws when the token matches no student', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(scanAttendance('bad-token', 'group1', 'b1')).rejects.toThrow('Student not found');
    });

    it('throws when the student belongs to a different branch than the scanning device', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ ...enrolledStudent, branchId: 'other-branch' });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Student not found');
    });

    it('throws when the student is not enrolled in the given group', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ ...enrolledStudent, groupIds: ['other-group'] });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Student is not enrolled in this group');
    });

    it('throws when the group belongs to a different branch than the scanning device', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(enrolledStudent);
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({ id: 'group1', branchId: 'other-branch', timeSlots: [] });

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Group not found');
    });

    it('records a PRESENT scan against the session, stamped with the scanning branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(enrolledStudent);
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            name: 'Maths 2Bac',
            branchId: 'b1',
            timeSlots: [{ day: 'Lundi', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.create as jest.Mock).mockResolvedValue({ id: 'att1', status: 'PRESENT' });

        const result = await scanAttendance('tok', 'group1', 'b1');

        expect(result.status).toBe('PRESENT');
        expect(prisma.attendance.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ branchId: 'b1', slotStart: '09:00', source: 'SCAN', status: 'PRESENT' }),
        });
    });

    it('rejects a second scan for the same session', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(enrolledStudent);
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            branchId: 'b1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([{ id: 'att1', slotStart: '09:00' }]);

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Attendance already marked for this session');
        expect(prisma.attendance.create).not.toHaveBeenCalled();
    });

    it('accepts a scan for the afternoon session when the morning one is already recorded', async () => {
        jest.setSystemTime(new Date(2026, 7, 31, 14, 1, 0));
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(enrolledStudent);
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            name: 'CE6',
            branchId: 'b1',
            timeSlots: [
                { day: 'Lundi', startTime: '08:30', endTime: '12:00' },
                { day: 'Lundi', startTime: '14:00', endTime: '16:30' },
            ],
        });
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([{ id: 'am', slotStart: '08:30' }]);
        (prisma.attendance.create as jest.Mock).mockResolvedValue({ id: 'pm', status: 'PRESENT' });

        await scanAttendance('tok', 'group1', 'b1');

        expect(prisma.attendance.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ slotStart: '14:00' }),
        });
    });

    it('translates a P2002 unique-constraint race into the friendly duplicate-scan message', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue(enrolledStudent);
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'group1',
            branchId: 'b1',
            timeSlots: [{ day: 'Monday', startTime: '09:00', endTime: '10:00' }],
        });
        (prisma.attendance.create as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
        );

        await expect(scanAttendance('tok', 'group1', 'b1')).rejects.toThrow('Attendance already marked for this session');
    });
});

describe('findSessionRecord', () => {
    it('matches a record by its session start', () => {
        expect(findSessionRecord([{ slotStart: '14:00' }], '14:00', '08:30')).toEqual({ slotStart: '14:00' });
    });

    it('attaches a record from before sessions were tracked to the first session of the day only', () => {
        const legacy = { slotStart: null };
        expect(findSessionRecord([legacy], '08:30', '08:30')).toBe(legacy);
        expect(findSessionRecord([legacy], '14:00', '08:30')).toBeUndefined();
    });
});

describe('getAttendanceByStudent', () => {
    afterEach(() => jest.clearAllMocks());

    it('throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(getAttendanceByStudent('s1', 'b1')).rejects.toThrow('Student not found');
    });

    it('filters attendance by branchId', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);

        await getAttendanceByStudent('s1', 'b1');

        expect(prisma.attendance.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { studentId: 's1', branchId: 'b1' } })
        );
    });
});

describe('getWeeklyAttendance', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'g1',
            name: 'CE6',
            type: 'SOUTIEN',
            room: 'Salle 2',
            branchId: 'b1',
            teacher: { name: 'Karim Tazi' },
            timeSlots: [
                { day: 'Lundi', startTime: '14:00', endTime: '16:00' },
                { day: 'Lundi', startTime: '08:30', endTime: '12:00' },
                { day: 'Mercredi', startTime: '08:30', endTime: '12:00' },
            ],
            students: [
                { id: 's2', name: 'Youssef', surname: 'Idrissi' },
                { id: 's1', name: 'Amine', surname: 'Alaoui' },
            ],
        });
        (prisma.holiday.findMany as jest.Mock).mockResolvedValue([
            { title: 'Fête', startDate: new Date('2026-09-02'), endDate: new Date('2026-09-02') },
        ]);
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([
            { id: 'a1', studentId: 's1', date: new Date(2026, 7, 31), slotStart: '14:00', status: 'LATE', source: 'SCAN' },
            { id: 'a0', studentId: 's2', date: new Date(2026, 7, 31), slotStart: null, status: 'PRESENT', source: 'SCAN' },
        ]);
    });

    it('builds a Monday-first week with each day’s sessions and holidays, from any day in the week', async () => {
        const week = await getWeeklyAttendance('g1', '2026-09-03', 'b1');

        expect(week.weekStart).toBe('2026-08-31');
        expect(week.days).toHaveLength(7);
        expect(week.days[0]).toEqual({
            date: '2026-08-31',
            holiday: null,
            slots: [
                { startTime: '08:30', endTime: '12:00' },
                { startTime: '14:00', endTime: '16:00' },
            ],
        });
        expect(week.days[1].slots).toEqual([]);
        expect(week.days[2].holiday).toBe('Fête');
        expect(week.group.teacherName).toBe('Karim Tazi');
    });

    it('sorts students by name and places legacy records on the first session of their day', async () => {
        const week = await getWeeklyAttendance('g1', '2026-08-31', 'b1');

        expect(week.students.map((s) => s.id)).toEqual(['s1', 's2']);
        expect(week.records.find((r) => r.id === 'a0')?.slotStart).toBe('08:30');
        expect(week.records.find((r) => r.id === 'a1')?.slotStart).toBe('14:00');
    });

    it('refuses a group of another branch', async () => {
        await expect(getWeeklyAttendance('g1', '2026-08-31', 'b2')).rejects.toThrow('Group not found');
    });

    it('refuses a malformed week', async () => {
        await expect(getWeeklyAttendance('g1', '31/08/2026', 'b1')).rejects.toThrow('Invalid week date');
    });
});

describe('markAttendance', () => {
    const base = {
        studentId: 's1',
        groupId: 'g1',
        date: '2026-08-31',
        slotStart: '08:30',
        status: 'ABSENT',
        branchId: 'b1',
        userId: 'u1',
    };

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 31, 10, 0, 0));
        jest.clearAllMocks();
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'g1',
            branchId: 'b1',
            studentIds: ['s1'],
            timeSlots: [
                { day: 'Lundi', startTime: '08:30', endTime: '12:00' },
                { day: 'Lundi', startTime: '14:00', endTime: '16:00' },
            ],
        });
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.holiday.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.attendance.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data }));
        (prisma.attendance.update as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'old', ...data }));
    });

    afterEach(() => jest.useRealTimers());

    it('creates a manual record with who marked it', async () => {
        await markAttendance({ ...base, note: '  ' });

        expect(prisma.attendance.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                status: 'ABSENT',
                source: 'MANUAL',
                markedById: 'u1',
                slotStart: '08:30',
                note: null,
                branchId: 'b1',
                date: new Date(2026, 7, 31),
            }),
        });
    });

    it('corrects an existing record (e.g. an automatic absence turned into a justified one)', async () => {
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([{ id: 'old', slotStart: '08:30', status: 'ABSENT' }]);

        await markAttendance({ ...base, status: 'JUSTIFIED', note: 'Certificat médical' });

        expect(prisma.attendance.update).toHaveBeenCalledWith({
            where: { id: 'old' },
            data: expect.objectContaining({ status: 'JUSTIFIED', note: 'Certificat médical', source: 'MANUAL' }),
        });
        expect(prisma.attendance.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown status', async () => {
        await expect(markAttendance({ ...base, status: 'SICK' })).rejects.toThrow('Status must be one of');
    });

    it('rejects a time that is not one of the group’s sessions that day', async () => {
        await expect(markAttendance({ ...base, slotStart: '10:00' })).rejects.toThrow('no session at this time');
    });

    it('rejects a student who is not in the group', async () => {
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'g1', branchId: 'b1', studentIds: [], timeSlots: [{ day: 'Lundi', startTime: '08:30', endTime: '12:00' }],
        });
        await expect(markAttendance(base)).rejects.toThrow('not enrolled');
    });

    it('rejects a student of another branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b2' });
        await expect(markAttendance(base)).rejects.toThrow('Student not found');
    });

    it('rejects a holiday', async () => {
        (prisma.holiday.findMany as jest.Mock).mockResolvedValue([
            { title: 'Fête', startDate: new Date('2026-08-31'), endDate: new Date('2026-08-31') },
        ]);
        await expect(markAttendance(base)).rejects.toThrow('holiday');
    });

    it('refuses presence for a session that has not started, but accepts an advance excuse', async () => {
        await expect(markAttendance({ ...base, slotStart: '14:00', status: 'PRESENT' })).rejects.toThrow('not started');

        await markAttendance({ ...base, slotStart: '14:00', status: 'JUSTIFIED', note: 'Rendez-vous médecin' });
        expect(prisma.attendance.create).toHaveBeenCalled();
    });
});

describe('markSession', () => {
    const base = { groupId: 'g1', date: '2026-08-31', slotStart: '08:30', branchId: 'b1', userId: 'u1' };

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 7, 31, 10, 0, 0));
        jest.clearAllMocks();
        (prisma.group.findUnique as jest.Mock).mockResolvedValue({
            id: 'g1',
            branchId: 'b1',
            studentIds: ['s1', 's2'],
            timeSlots: [
                { day: 'Lundi', startTime: '08:30', endTime: '10:00' },
                { day: 'Lundi', startTime: '10:00', endTime: '12:00' },
                { day: 'Lundi', startTime: '14:00', endTime: '16:00' },
                { day: 'Lundi', startTime: '20:00', endTime: '22:00' },
            ],
        });
        (prisma.holiday.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.attendance.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: data.studentId, ...data }));
        (prisma.attendance.update as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ id: 'old', ...data }));
    });

    afterEach(() => jest.useRealTimers());

    it('saves the roll of the whole session', async () => {
        const saved = await markSession({
            ...base,
            entries: [
                { studentId: 's1', status: 'PRESENT' },
                { studentId: 's2', status: 'ABSENT', note: 'malade' },
            ],
        });

        expect(saved).toHaveLength(2);
        expect(prisma.attendance.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ studentId: 's2', status: 'ABSENT', note: 'malade', slotStart: '08:30' }),
        });
    });

    it('writes nothing when one entry is invalid', async () => {
        await expect(
            markSession({
                ...base,
                entries: [
                    { studentId: 's1', status: 'PRESENT' },
                    { studentId: 'stranger', status: 'PRESENT' },
                ],
            })
        ).rejects.toThrow('not enrolled');
        expect(prisma.attendance.create).not.toHaveBeenCalled();
    });

    it('rejects a student listed twice', async () => {
        await expect(
            markSession({
                ...base,
                entries: [
                    { studentId: 's1', status: 'PRESENT' },
                    { studentId: 's1', status: 'ABSENT' },
                ],
            })
        ).rejects.toThrow('once');
    });

    it('rejects an empty roll', async () => {
        await expect(markSession({ ...base, entries: [] })).rejects.toThrow('non-empty');
    });

    it('supports four sessions the same day, up to the evening', async () => {
        await expect(
            markSession({ ...base, slotStart: '20:00', entries: [{ studentId: 's1', status: 'PRESENT' }] })
        ).rejects.toThrow('not started');

        jest.setSystemTime(new Date(2026, 7, 31, 21, 0, 0));
        await markSession({ ...base, slotStart: '20:00', entries: [{ studentId: 's1', status: 'PRESENT' }] });
        expect(prisma.attendance.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ slotStart: '20:00' }),
        });
    });
});
