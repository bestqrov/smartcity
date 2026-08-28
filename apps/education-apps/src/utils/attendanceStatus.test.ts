import { deriveAttendanceStatus, TimeSlot } from './attendanceStatus';

const mondaySlot: TimeSlot = { day: 'Monday', startTime: '09:00', endTime: '10:00' };

// 2026-08-31 is a Monday
const mondayAt = (hh: number, mm: number) => new Date(2026, 7, 31, hh, mm, 0);

describe('deriveAttendanceStatus', () => {
    it('returns PRESENT when scanned before the slot start', () => {
        expect(deriveAttendanceStatus([mondaySlot], mondayAt(8, 55))).toBe('PRESENT');
    });

    it('returns PRESENT when scanned within the grace period', () => {
        expect(deriveAttendanceStatus([mondaySlot], mondayAt(9, 4))).toBe('PRESENT');
    });

    it('returns LATE when scanned after the grace period', () => {
        expect(deriveAttendanceStatus([mondaySlot], mondayAt(9, 6))).toBe('LATE');
    });

    it('selects the closest same-day slot when there are multiple sessions on that day', () => {
        const morningSlot: TimeSlot = { day: 'Monday', startTime: '09:00', endTime: '10:00' };
        const eveningSlot: TimeSlot = { day: 'Monday', startTime: '14:00', endTime: '15:00' };
        expect(deriveAttendanceStatus([morningSlot, eveningSlot], mondayAt(14, 2))).toBe('PRESENT');
    });

    it('throws when there is no slot for the scan day', () => {
        const tuesdaySlot: TimeSlot = { day: 'Tuesday', startTime: '09:00', endTime: '10:00' };
        expect(() => deriveAttendanceStatus([tuesdaySlot], mondayAt(9, 0))).toThrow(
            'No scheduled session for this group today'
        );
    });
});
