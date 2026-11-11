import {
    dayIndexOf,
    deriveAttendanceStatus,
    holidayOn,
    parseDateKey,
    resolveScanSession,
    slotsOnDate,
    TimeSlot,
    timetableError,
    toDateKey,
} from './attendanceStatus';

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

describe('day names', () => {
    it('understands the French day names the groups page saves', () => {
        const lundi: TimeSlot = { day: 'Lundi', startTime: '09:00', endTime: '10:00' };
        expect(deriveAttendanceStatus([lundi], mondayAt(9, 2))).toBe('PRESENT');
    });

    it('maps French, English and Arabic names to the same weekday, ignoring case', () => {
        expect(dayIndexOf('Mercredi')).toBe(3);
        expect(dayIndexOf('wednesday')).toBe(3);
        expect(dayIndexOf('الأربعاء')).toBe(3);
        expect(dayIndexOf('Funday')).toBeNull();
    });

    it('lists only the given date’s sessions, earliest first', () => {
        const slots: TimeSlot[] = [
            { day: 'Lundi', startTime: '14:00', endTime: '15:00' },
            { day: 'Mardi', startTime: '08:00', endTime: '09:00' },
            { day: 'Monday', startTime: '08:30', endTime: '10:00' },
        ];
        expect(slotsOnDate(slots, mondayAt(0, 0)).map((s) => s.startTime)).toEqual(['08:30', '14:00']);
    });
});

describe('resolveScanSession', () => {
    it('returns the closest session so the scan is recorded against it', () => {
        const morning: TimeSlot = { day: 'Lundi', startTime: '08:30', endTime: '10:00' };
        const afternoon: TimeSlot = { day: 'Lundi', startTime: '14:00', endTime: '16:00' };
        expect(resolveScanSession([morning, afternoon], mondayAt(14, 20))).toEqual({ slot: afternoon, status: 'LATE' });
    });
});

describe('date keys', () => {
    it('round-trips local dates and rejects impossible ones', () => {
        expect(toDateKey(parseDateKey('2026-02-28')!)).toBe('2026-02-28');
        expect(parseDateKey('2026-02-30')).toBeNull();
        expect(parseDateKey('28/02/2026')).toBeNull();
    });
});

describe('holidayOn', () => {
    const toussaint = {
        title: 'Vacances',
        startDate: new Date('2026-08-30'),
        endDate: new Date('2026-09-01'),
    };

    it('includes both ends of the holiday range', () => {
        expect(holidayOn([toussaint], new Date(2026, 7, 30))).toBe(toussaint);
        expect(holidayOn([toussaint], mondayAt(9, 0))).toBe(toussaint);
        expect(holidayOn([toussaint], new Date(2026, 8, 1))).toBe(toussaint);
    });

    it('returns null outside the range', () => {
        expect(holidayOn([toussaint], new Date(2026, 8, 2))).toBeNull();
    });
});

describe('timetableError', () => {
    it('accepts four sessions a day from morning to late evening', () => {
        expect(
            timetableError([
                { day: 'Lundi', startTime: '08:00', endTime: '10:00' },
                { day: 'Lundi', startTime: '10:00', endTime: '12:00' },
                { day: 'Lundi', startTime: '14:00', endTime: '16:00' },
                { day: 'Lundi', startTime: '21:30', endTime: '23:30' },
            ])
        ).toBeNull();
    });

    it('accepts no timetable at all', () => {
        expect(timetableError(undefined)).toBeNull();
        expect(timetableError([])).toBeNull();
    });

    it('rejects sessions outside 08:00 - 23:30', () => {
        expect(timetableError([{ day: 'Lundi', startTime: '07:30', endTime: '09:00' }])).toMatch('entre 08:00 et 23:30');
        expect(timetableError([{ day: 'Lundi', startTime: '22:00', endTime: '23:45' }])).toMatch('entre 08:00 et 23:30');
    });

    it('rejects a session ending before it starts, bad times and unknown days', () => {
        expect(timetableError([{ day: 'Lundi', startTime: '10:00', endTime: '09:00' }])).toMatch('finir après');
        expect(timetableError([{ day: 'Lundi', startTime: '9h', endTime: '10:00' }])).toMatch('Heure invalide');
        expect(timetableError([{ day: 'Funday', startTime: '09:00', endTime: '10:00' }])).toMatch('Jour inconnu');
    });

    it('rejects overlapping sessions the same day, even written in different languages', () => {
        expect(
            timetableError([
                { day: 'Lundi', startTime: '09:00', endTime: '11:00' },
                { day: 'Monday', startTime: '10:30', endTime: '12:00' },
            ])
        ).toMatch('se chevauchent');
    });
});
