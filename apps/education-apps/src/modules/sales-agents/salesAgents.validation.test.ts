import {
    normalizeCode,
    sanitizeCode,
    computeCommission,
    roundMoney,
    sanitizeNewAgent,
    sanitizeAgentUpdate,
    sanitizePackRates,
    sanitizePayment,
    sanitizePayout,
    resolveCommissionRate,
    LEGACY_RATE_ERROR,
} from './salesAgents.validation';

const PACK_A = '6ab050b281878c35b0f00752';
const PACK_B = '6ab050b181878c35b0f00750';

describe('normalizeCode', () => {
    it('trims and uppercases strings', () => {
        expect(normalizeCode('  youssef22 ')).toBe('YOUSSEF22');
    });
    it('returns an empty string for non-strings', () => {
        expect(normalizeCode(42)).toBe('');
        expect(normalizeCode({ $ne: null })).toBe('');
        expect(normalizeCode(undefined)).toBe('');
    });
});

describe('sanitizeCode', () => {
    it('accepts 3-20 letters, digits or dashes', () => {
        expect(sanitizeCode('arwa')).toBe('ARWA');
        expect(sanitizeCode('ali-2026')).toBe('ALI-2026');
    });
    it('rejects too short, too long or invalid characters', () => {
        expect(() => sanitizeCode('ab')).toThrow('Code must be 3-20 letters, digits or dashes');
        expect(() => sanitizeCode('A'.repeat(21))).toThrow('Code must be 3-20 letters, digits or dashes');
        expect(() => sanitizeCode('ALI 22')).toThrow('Code must be 3-20 letters, digits or dashes');
    });
});

describe('money', () => {
    it('rounds to 2 decimals', () => {
        expect(roundMoney(52.499999)).toBe(52.5);
        expect(roundMoney(3.14159)).toBe(3.14);
    });
    it('computes commission = amount * rate / 100, rounded', () => {
        expect(computeCommission(350, 15)).toBe(52.5);
        expect(computeCommission(199, 12.5)).toBe(24.88);
        expect(computeCommission(500, 0)).toBe(0);
    });
});

describe('sanitizePackRates', () => {
    it('returns clean exceptions, lowercasing pack ids and parsing rates', () => {
        expect(
            sanitizePackRates([
                { packId: PACK_A.toUpperCase(), period: 'YEARLY', rate: '20' },
                { packId: PACK_A, period: 'MONTHLY', rate: 12.5 },
                { packId: PACK_B, period: 'SEMIANNUAL', rate: 0 },
            ])
        ).toEqual([
            { packId: PACK_A, period: 'YEARLY', rate: 20 },
            { packId: PACK_A, period: 'MONTHLY', rate: 12.5 },
            { packId: PACK_B, period: 'SEMIANNUAL', rate: 0 },
        ]);
    });
    it('accepts an empty list', () => {
        expect(sanitizePackRates([])).toEqual([]);
    });
    it('rejects a non-list', () => {
        expect(() => sanitizePackRates({ packId: PACK_A })).toThrow('Pack rates must be a list');
        expect(() => sanitizePackRates(null)).toThrow('Pack rates must be a list');
    });
    it('rejects a missing or malformed pack id', () => {
        expect(() => sanitizePackRates([{ period: 'YEARLY', rate: 10 }])).toThrow('Invalid pack id');
        expect(() => sanitizePackRates([{ packId: 'abc', period: 'YEARLY', rate: 10 }])).toThrow('Invalid pack id');
        expect(() => sanitizePackRates([null])).toThrow('Invalid pack id');
    });
    it('rejects a bad period', () => {
        expect(() => sanitizePackRates([{ packId: PACK_A, period: 'WEEKLY', rate: 10 }])).toThrow(
            'Period must be MONTHLY, SEMIANNUAL or YEARLY'
        );
    });
    it('rejects a rate outside 0-100', () => {
        expect(() => sanitizePackRates([{ packId: PACK_A, period: 'YEARLY', rate: 101 }])).toThrow('Pack rate must be between 0 and 100');
        expect(() => sanitizePackRates([{ packId: PACK_A, period: 'YEARLY' }])).toThrow('Pack rate must be between 0 and 100');
    });
    it('rejects the same pack twice for one period, whatever the case of the id', () => {
        expect(() =>
            sanitizePackRates([
                { packId: PACK_A, period: 'YEARLY', rate: 20 },
                { packId: PACK_A.toUpperCase(), period: 'YEARLY', rate: 22 },
            ])
        ).toThrow('A pack can only have one rate per period');
    });
});

describe('sanitizeNewAgent', () => {
    const valid = {
        name: ' Youssef ',
        email: ' Youssef@Example.com ',
        password: 'secret123',
        phone: '0600000000',
        code: 'youssef22',
        monthlyRate: '10',
        semiannualRate: 15,
        yearlyRate: 25,
    };

    it('returns clean data with no pack exceptions by default', () => {
        expect(sanitizeNewAgent(valid)).toEqual({
            name: 'Youssef',
            email: 'youssef@example.com',
            password: 'secret123',
            phone: '0600000000',
            code: 'YOUSSEF22',
            monthlyRate: 10,
            semiannualRate: 15,
            yearlyRate: 25,
            packRates: [],
        });
        expect(sanitizeNewAgent({ ...valid, packRates: null }).packRates).toEqual([]);
    });
    it('keeps sanitized pack exceptions', () => {
        expect(sanitizeNewAgent({ ...valid, packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }] }).packRates).toEqual([
            { packId: PACK_A, period: 'YEARLY', rate: 20 },
        ]);
    });
    it('rejects a short password', () => {
        expect(() => sanitizeNewAgent({ ...valid, password: 'short' })).toThrow('Password must be at least 8 characters');
    });
    it('rejects a missing name or a bad email', () => {
        expect(() => sanitizeNewAgent({ ...valid, name: '  ' })).toThrow('Name is required');
        expect(() => sanitizeNewAgent({ ...valid, email: 'nope' })).toThrow('Email is invalid');
    });
    it('requires the three rates, each between 0 and 100', () => {
        const { semiannualRate: _s, ...withoutSemiannual } = valid;
        expect(() => sanitizeNewAgent(withoutSemiannual)).toThrow('Semi-annual rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, monthlyRate: 101 })).toThrow('Monthly rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, semiannualRate: -1 })).toThrow('Semi-annual rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, yearlyRate: 'abc' })).toThrow('Yearly rate must be between 0 and 100');
    });
    it('rejects the v1 single rate', () => {
        expect(() => sanitizeNewAgent({ ...valid, commissionRate: 15 })).toThrow(LEGACY_RATE_ERROR);
    });
});

describe('sanitizeAgentUpdate', () => {
    it('keeps only the provided editable fields', () => {
        expect(sanitizeAgentUpdate({ monthlyRate: 20 })).toEqual({ monthlyRate: 20 });
        expect(sanitizeAgentUpdate({ semiannualRate: '12.5', yearlyRate: 30 })).toEqual({ semiannualRate: 12.5, yearlyRate: 30 });
        expect(sanitizeAgentUpdate({ name: 'Ali', phone: '', active: false })).toEqual({
            name: 'Ali',
            phone: null,
            active: false,
        });
    });
    it('replaces the whole pack exception list when sent', () => {
        expect(sanitizeAgentUpdate({ packRates: [{ packId: PACK_B, period: 'MONTHLY', rate: 8 }] })).toEqual({
            packRates: [{ packId: PACK_B, period: 'MONTHLY', rate: 8 }],
        });
        expect(sanitizeAgentUpdate({ packRates: [] })).toEqual({ packRates: [] });
    });
    it('validates rates and exceptions', () => {
        expect(() => sanitizeAgentUpdate({ yearlyRate: 150 })).toThrow('Yearly rate must be between 0 and 100');
        expect(() => sanitizeAgentUpdate({ packRates: 'none' })).toThrow('Pack rates must be a list');
    });
    it('rejects the v1 single rate', () => {
        expect(() => sanitizeAgentUpdate({ commissionRate: 20 })).toThrow(LEGACY_RATE_ERROR);
    });
    it('refuses to change the code or the house flag', () => {
        expect(() => sanitizeAgentUpdate({ code: 'NEW' })).toThrow('The code cannot be changed');
        expect(() => sanitizeAgentUpdate({ isHouse: true })).toThrow('The company flag cannot be changed');
    });
    it('rejects a non-boolean active', () => {
        expect(() => sanitizeAgentUpdate({ active: 'yes' })).toThrow('Active must be true or false');
    });
});

describe('sanitizePayment', () => {
    it('returns clean data', () => {
        expect(sanitizePayment({ amount: '350', period: 'MONTHLY', paidAt: '2026-11-01', note: ' cash ' })).toEqual({
            amount: 350,
            period: 'MONTHLY',
            paidAt: new Date('2026-11-01'),
            note: 'cash',
        });
    });
    it('accepts the semi-annual period', () => {
        expect(sanitizePayment({ amount: 1500, period: 'SEMIANNUAL', paidAt: '2026-11-01' }).period).toBe('SEMIANNUAL');
    });
    it('rejects a zero/negative amount, a bad period or a bad date', () => {
        expect(() => sanitizePayment({ amount: 0, period: 'MONTHLY', paidAt: '2026-11-01' })).toThrow('Amount must be greater than 0');
        expect(() => sanitizePayment({ amount: 10, period: 'WEEKLY', paidAt: '2026-11-01' })).toThrow(
            'Period must be MONTHLY, SEMIANNUAL or YEARLY'
        );
        expect(() => sanitizePayment({ amount: 10, period: 'YEARLY', paidAt: 'nope' })).toThrow('Payment date must be a valid date');
    });
});

describe('sanitizePayout', () => {
    it('returns clean data', () => {
        expect(sanitizePayout({ amount: 3000, paidAt: '2026-11-10', note: 'virement' })).toEqual({
            amount: 3000,
            paidAt: new Date('2026-11-10'),
            note: 'virement',
        });
    });
    it('rejects a bad amount or date', () => {
        expect(() => sanitizePayout({ amount: -5, paidAt: '2026-11-10' })).toThrow('Amount must be greater than 0');
        expect(() => sanitizePayout({ amount: 5 })).toThrow('Payout date must be a valid date');
    });
});

describe('date strictness', () => {
    it.each(['1', '2026-02-31', '2026-13-01', '11/01/2026', '0000-01-01', '1999-12-31', '2101-01-01', '2026-11-10T08:30:00.000Z'])('rejects %s', (bad) => {
        expect(() => sanitizePayment({ amount: 10, period: 'MONTHLY', paidAt: bad })).toThrow('Payment date must be a valid date');
        expect(() => sanitizePayout({ amount: 10, paidAt: bad })).toThrow('Payout date must be a valid date');
    });
    it('accepts a plain date and a Date instance', () => {
        expect(sanitizePayout({ amount: 10, paidAt: '2026-11-10' }).paidAt).toEqual(new Date('2026-11-10'));
        const d = new Date('2026-11-10');
        expect(sanitizePayout({ amount: 10, paidAt: d }).paidAt).toEqual(d);
    });
});

describe('resolveCommissionRate', () => {
    const agent = {
        monthlyRate: 10,
        semiannualRate: 15,
        yearlyRate: 25,
        packRates: [{ packId: PACK_A, period: 'YEARLY', rate: 20 }],
    };

    it('uses the exception for the school pack and the period', () => {
        expect(resolveCommissionRate(agent, PACK_A, 'YEARLY')).toBe(20);
    });
    it('falls back to the base rate of the period', () => {
        expect(resolveCommissionRate(agent, PACK_A, 'MONTHLY')).toBe(10);
        expect(resolveCommissionRate(agent, PACK_A, 'SEMIANNUAL')).toBe(15);
        expect(resolveCommissionRate(agent, PACK_B, 'YEARLY')).toBe(25);
    });
    it('uses the base rate for a school without a pack', () => {
        expect(resolveCommissionRate(agent, null, 'YEARLY')).toBe(25);
        expect(resolveCommissionRate(agent, undefined, 'MONTHLY')).toBe(10);
    });
    it('is 0 without an agent', () => {
        expect(resolveCommissionRate(null, PACK_A, 'YEARLY')).toBe(0);
        expect(resolveCommissionRate(undefined, null, 'MONTHLY')).toBe(0);
    });
    it('an exception at 0 % wins over a non-zero base rate', () => {
        expect(resolveCommissionRate({ ...agent, packRates: [{ packId: PACK_B, period: 'MONTHLY', rate: 0 }] }, PACK_B, 'MONTHLY')).toBe(0);
    });
});
