import { formatDayMonth } from './format';

describe('formatDayMonth', () => {
    it('formats in Africa/Casablanca time with latin digits', () => {
        // 23:30 UTC on 19/11 is already 20/11 in Casablanca (UTC+1).
        const d = new Date('2026-11-19T23:30:00Z');
        expect(formatDayMonth(d, 'fr')).toBe('20/11');
        expect(formatDayMonth(d, 'ar')).toBe('20/11');
        expect(formatDayMonth(new Date('2026-03-05T10:00:00Z'), 'fr')).toBe('05/03');
    });
});
