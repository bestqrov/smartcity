import prisma from '../../config/database';
import { runAbsenceSweep } from './absence-job';
import { sendAttendanceNotification } from '../notifications/notification.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        group: { findMany: jest.fn() },
        holiday: { findMany: jest.fn() },
        attendance: { findMany: jest.fn(), create: jest.fn() },
    },
}));

jest.mock('../notifications/notification.service', () => ({
    sendAttendanceNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

// 2026-08-31 is a Monday
const at = (hh: number, mm: number) => new Date(2026, 7, 31, hh, mm, 0);

const group = {
    id: 'g1',
    name: 'CE6',
    branchId: 'b1',
    timeSlots: [
        { day: 'Lundi', startTime: '08:30', endTime: '12:00' },
        { day: 'Lundi', startTime: '14:00', endTime: '16:00' },
    ],
    students: [
        { id: 's1', name: 'Amine', surname: 'Alaoui', parentId: 'p1' },
        { id: 's2', name: 'Sara', surname: 'Bennani', parentId: null },
    ],
};

describe('runAbsenceSweep', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.group.findMany as jest.Mock).mockResolvedValue([group]);
        (prisma.holiday.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.attendance.create as jest.Mock).mockImplementation(({ data }) =>
            Promise.resolve({ id: `${data.studentId}-${data.slotStart}`, ...data })
        );
    });

    afterEach(() => jest.useRealTimers());

    it('does nothing before a session’s grace period has passed', async () => {
        jest.useFakeTimers().setSystemTime(at(12, 5));
        await runAbsenceSweep();
        expect(prisma.attendance.create).not.toHaveBeenCalled();
    });

    it('marks unrecorded students absent for each ended session (French day names) and notifies parents', async () => {
        jest.useFakeTimers().setSystemTime(at(12, 10));
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([
            { studentId: 's2', slotStart: '08:30', status: 'PRESENT' },
        ]);

        await runAbsenceSweep();

        expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
        expect(prisma.attendance.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ studentId: 's1', slotStart: '08:30', status: 'ABSENT', source: 'AUTO' }),
        });
        expect(sendAttendanceNotification).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ parentId: 'p1', message: expect.stringContaining('08:30 - 12:00') })
        );
    });

    it('handles the afternoon session separately from the morning one', async () => {
        jest.useFakeTimers().setSystemTime(at(16, 20));
        (prisma.attendance.findMany as jest.Mock).mockResolvedValue([
            { studentId: 's1', slotStart: '08:30', status: 'PRESENT' },
            { studentId: 's2', slotStart: '08:30', status: 'ABSENT' },
            { studentId: 's2', slotStart: '14:00', status: 'PRESENT' },
        ]);

        await runAbsenceSweep();

        expect(prisma.attendance.create).toHaveBeenCalledTimes(1);
        expect(prisma.attendance.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ studentId: 's1', slotStart: '14:00' }),
        });
    });

    it('skips branches on holiday', async () => {
        jest.useFakeTimers().setSystemTime(at(17, 0));
        (prisma.holiday.findMany as jest.Mock).mockResolvedValue([
            { branchId: 'b1', title: 'Fête', startDate: new Date('2026-08-31'), endDate: new Date('2026-08-31') },
        ]);

        await runAbsenceSweep();

        expect(prisma.attendance.create).not.toHaveBeenCalled();
    });

    it('ignores a duplicate written concurrently by a scan', async () => {
        jest.useFakeTimers().setSystemTime(at(12, 10));
        (prisma.attendance.create as jest.Mock).mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await runAbsenceSweep();

        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });
});
