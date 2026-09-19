import { resolveMonthlyPrice } from './pricing';

const route = { monthlyPrice: 300 };
const stop = { monthlyPrice: 250 };

describe('resolveMonthlyPrice', () => {
    it('ROUTE uses the route price', () => {
        expect(resolveMonthlyPrice('ROUTE', route, stop, 200)).toBe(300);
    });

    it('STOP uses the stop price', () => {
        expect(resolveMonthlyPrice('STOP', route, stop, 200)).toBe(250);
    });

    it('UNIFORM uses the branch uniform price', () => {
        expect(resolveMonthlyPrice('UNIFORM', route, stop, 200)).toBe(200);
    });

    it('treats a missing mode as ROUTE', () => {
        expect(resolveMonthlyPrice(null, route, stop, 200)).toBe(300);
        expect(resolveMonthlyPrice(undefined, route, stop, 200)).toBe(300);
    });

    it('throws when the price for the mode is not configured', () => {
        expect(() => resolveMonthlyPrice('ROUTE', { monthlyPrice: null }, stop, 200)).toThrow(
            'Transport price is not configured for pricing mode ROUTE'
        );
        expect(() => resolveMonthlyPrice('STOP', route, { monthlyPrice: 0 }, 200)).toThrow(
            'Transport price is not configured for pricing mode STOP'
        );
        expect(() => resolveMonthlyPrice('UNIFORM', route, stop, null)).toThrow(
            'Transport price is not configured for pricing mode UNIFORM'
        );
    });
});
