// Codes are compared uppercased and trimmed everywhere (signup, check endpoint, creation).
export const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;
export const PERIODS = ['MONTHLY', 'YEARLY'] as const;
export type PeriodValue = (typeof PERIODS)[number];

export const normalizeCode = (raw: unknown): string => (typeof raw === 'string' ? raw.trim().toUpperCase() : '');

export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const computeCommission = (amount: number, rate: number): number => roundMoney((amount * rate) / 100);

const requireText = (label: string, value: unknown): string => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
    return value.trim();
};

const optionalText = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

const toNumber = (value: unknown): number =>
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;

const parseRate = (value: unknown): number => {
    const rate = toNumber(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Commission rate must be between 0 and 100');
    return rate;
};

const parseAmount = (value: unknown): number => {
    const amount = toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than 0');
    return roundMoney(amount);
};

const parseDate = (label: string, value: unknown): Date => {
    const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid date`);
    return date;
};

export const sanitizeCode = (raw: unknown): string => {
    const code = normalizeCode(raw);
    if (!CODE_PATTERN.test(code)) throw new Error('Code must be 3-20 letters, digits or dashes');
    return code;
};

export interface NewAgentData {
    name: string;
    email: string;
    password: string;
    phone?: string;
    code: string;
    commissionRate: number;
}

export const sanitizeNewAgent = (input: Record<string, unknown>): NewAgentData => {
    const password = typeof input.password === 'string' ? input.password : '';
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    const name = requireText('Name', input.name);
    const email = requireText('Email', input.email).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email is invalid');
    return {
        name,
        email,
        password,
        phone: optionalText(input.phone),
        code: sanitizeCode(input.code),
        commissionRate: parseRate(input.commissionRate),
    };
};

export interface AgentUpdateData {
    name?: string;
    phone?: string | null;
    commissionRate?: number;
    active?: boolean;
}

export const sanitizeAgentUpdate = (input: Record<string, unknown>): AgentUpdateData => {
    if (input.code !== undefined) throw new Error('The code cannot be changed');
    if (input.isHouse !== undefined) throw new Error('The company flag cannot be changed');
    const data: AgentUpdateData = {};
    if (input.name !== undefined) data.name = requireText('Name', input.name);
    if (input.phone !== undefined) data.phone = optionalText(input.phone) ?? null;
    if (input.commissionRate !== undefined) data.commissionRate = parseRate(input.commissionRate);
    if (input.active !== undefined) {
        if (typeof input.active !== 'boolean') throw new Error('Active must be true or false');
        data.active = input.active;
    }
    return data;
};

export interface PaymentData {
    amount: number;
    period: PeriodValue;
    paidAt: Date;
    note?: string;
}

export const sanitizePayment = (input: Record<string, unknown>): PaymentData => {
    const amount = parseAmount(input.amount);
    if (!PERIODS.includes(input.period as PeriodValue)) throw new Error('Period must be MONTHLY or YEARLY');
    return {
        amount,
        period: input.period as PeriodValue,
        paidAt: parseDate('Payment date', input.paidAt),
        note: optionalText(input.note),
    };
};

export interface PayoutData {
    amount: number;
    paidAt: Date;
    note?: string;
}

export const sanitizePayout = (input: Record<string, unknown>): PayoutData => ({
    amount: parseAmount(input.amount),
    paidAt: parseDate('Payout date', input.paidAt),
    note: optionalText(input.note),
});
