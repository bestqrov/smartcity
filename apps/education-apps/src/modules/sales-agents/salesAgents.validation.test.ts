import {
    normalizeCode,
    sanitizeCode,
    computeCommission,
    roundMoney,
    sanitizeNewAgent,
    sanitizeAgentUpdate,
    sanitizePayment,
    sanitizePayout,
} from './salesAgents.validation';

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

describe('sanitizeNewAgent', () => {
    const valid = {
        name: ' Youssef ',
        email: ' Youssef@Example.com ',
        password: 'secret123',
        phone: '0600000000',
        code: 'youssef22',
        commissionRate: '15',
    };

    it('returns clean data', () => {
        expect(sanitizeNewAgent(valid)).toEqual({
            name: 'Youssef',
            email: 'youssef@example.com',
            password: 'secret123',
            phone: '0600000000',
            code: 'YOUSSEF22',
            commissionRate: 15,
        });
    });
    it('rejects a short password', () => {
        expect(() => sanitizeNewAgent({ ...valid, password: 'short' })).toThrow('Password must be at least 8 characters');
    });
    it('rejects a missing name or a bad email', () => {
        expect(() => sanitizeNewAgent({ ...valid, name: '  ' })).toThrow('Name is required');
        expect(() => sanitizeNewAgent({ ...valid, email: 'nope' })).toThrow('Email is invalid');
    });
    it('rejects a rate outside 0-100', () => {
        expect(() => sanitizeNewAgent({ ...valid, commissionRate: 101 })).toThrow('Commission rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, commissionRate: -1 })).toThrow('Commission rate must be between 0 and 100');
        expect(() => sanitizeNewAgent({ ...valid, commissionRate: 'abc' })).toThrow('Commission rate must be between 0 and 100');
    });
});

describe('sanitizeAgentUpdate', () => {
    it('keeps only the provided editable fields', () => {
        expect(sanitizeAgentUpdate({ commissionRate: 20 })).toEqual({ commissionRate: 20 });
        expect(sanitizeAgentUpdate({ name: 'Ali', phone: '', active: false })).toEqual({
            name: 'Ali',
            phone: null,
            active: false,
        });
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
    it('rejects a zero/negative amount, a bad period or a bad date', () => {
        expect(() => sanitizePayment({ amount: 0, period: 'MONTHLY', paidAt: '2026-11-01' })).toThrow('Amount must be greater than 0');
        expect(() => sanitizePayment({ amount: 10, period: 'WEEKLY', paidAt: '2026-11-01' })).toThrow('Period must be MONTHLY or YEARLY');
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
