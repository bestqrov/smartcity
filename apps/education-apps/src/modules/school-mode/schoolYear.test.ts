import { currentSchoolYear, isDueMonth, isSchoolYear, startMonthFor } from './schoolYear';

describe('school year', () => {
    it('runs September to August', () => {
        expect(currentSchoolYear(new Date('2026-11-24T10:00:00Z'))).toBe('2026/2027');
        expect(currentSchoolYear(new Date('2027-03-01T10:00:00Z'))).toBe('2026/2027');
        expect(currentSchoolYear(new Date('2027-08-31T10:00:00Z'))).toBe('2026/2027');
        expect(currentSchoolYear(new Date('2027-09-01T10:00:00Z'))).toBe('2027/2028');
    });

    it('validates the "YYYY/YYYY+1" format', () => {
        expect(isSchoolYear('2026/2027')).toBe(true);
        expect(isSchoolYear('2026/2028')).toBe(false);
        expect(isSchoolYear('2026-2027')).toBe(false);
    });

    it('bills September to June only', () => {
        expect(isDueMonth('2026-09')).toBe(true);
        expect(isDueMonth('2027-06')).toBe(true);
        expect(isDueMonth('2027-07')).toBe(false);
        expect(isDueMonth('2027-08')).toBe(false);
    });

    it('starts the first month now, or in September when registering in summer', () => {
        expect(startMonthFor(new Date('2026-11-24T10:00:00Z'))).toBe('2026-11');
        expect(startMonthFor(new Date('2027-07-10T10:00:00Z'))).toBe('2027-09');
        expect(startMonthFor(new Date('2027-08-25T10:00:00Z'))).toBe('2027-09');
    });
    it('uses the Morocco time zone', () => {
        const now = new Date('2026-08-31T23:30:00Z');
        expect(currentSchoolYear(now)).toBe('2026/2027');
        expect(startMonthFor(now)).toBe('2026-09');
    });

    it('rejects malformed months as due months', () => {
        expect(isDueMonth('2026-13')).toBe(false);
        expect(isDueMonth('')).toBe(false);
        expect(isDueMonth('nope')).toBe(false);
    });
});
