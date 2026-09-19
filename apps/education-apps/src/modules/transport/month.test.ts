import { currentMonth, isValidMonth, startOfNextMonth } from './month';

describe('month helpers', () => {
    it('currentMonth formats a date as YYYY-MM with zero padding', () => {
        expect(currentMonth(new Date(2026, 8, 19))).toBe('2026-09');
        expect(currentMonth(new Date(2026, 11, 1))).toBe('2026-12');
    });

    it('isValidMonth accepts YYYY-MM only', () => {
        expect(isValidMonth('2026-09')).toBe(true);
        expect(isValidMonth('2026-13')).toBe(false);
        expect(isValidMonth('2026-9')).toBe(false);
        expect(isValidMonth('september')).toBe(false);
        expect(isValidMonth(undefined)).toBe(false);
    });

    it('startOfNextMonth returns the first instant of the following month', () => {
        expect(startOfNextMonth('2026-09')).toEqual(new Date(2026, 9, 1));
        expect(startOfNextMonth('2026-12')).toEqual(new Date(2027, 0, 1));
    });
});
