// Codes are compared uppercased and trimmed everywhere (signup, check endpoint, creation).
export const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;
export const PERIODS = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'] as const;
export type PeriodValue = (typeof PERIODS)[number];

const PERIOD_ERROR = 'Period must be MONTHLY, SEMIANNUAL or YEARLY';
const OBJECT_ID = /^[a-f0-9]{24}$/;
export const LEGACY_RATE_ERROR = 'commissionRate is no longer accepted: send monthlyRate, semiannualRate and yearlyRate';

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

const parseRate = (label: string, value: unknown): number => {
    const rate = toNumber(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error(`${label} must be between 0 and 100`);
    return rate;
};

const parseAmount = (value: unknown): number => {
    const amount = toNumber(value);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than 0');
    return roundMoney(amount);
};

const parseDate = (label: string, value: unknown): Date => {
    const invalid = new Error(`${label} must be a valid date`);
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) throw invalid;
        return value;
    }
    // Only a plain YYYY-MM-DD (2000-2100): `new Date('1')`, time parts and rolled-over days like 02-31 are rejected.
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid;
    const date = new Date(value);
    const year = Number(value.slice(0, 4));
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value || year < 2000 || year > 2100) throw invalid;
    return date;
};

const isPeriod = (value: unknown): value is PeriodValue => PERIODS.includes(value as PeriodValue);

export const sanitizeCode = (raw: unknown): string => {
    const code = normalizeCode(raw);
    if (!CODE_PATTERN.test(code)) throw new Error('Code must be 3-20 letters, digits or dashes');
    return code;
};

export interface PackRateData {
    packId: string;
    period: PeriodValue;
    rate: number;
}

// Pack exceptions: (pack, period) -> rate, overriding the base rate of that period for that pack.
// Pack existence is checked by the service (it needs the database).
export const sanitizePackRates = (value: unknown): PackRateData[] => {
    if (!Array.isArray(value)) throw new Error('Pack rates must be a list');
    const seen = new Set<string>();
    return value.map((item) => {
        const entry = (item !== null && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        const packId = typeof entry.packId === 'string' ? entry.packId.trim().toLowerCase() : '';
        if (!OBJECT_ID.test(packId)) throw new Error('Invalid pack id');
        if (!isPeriod(entry.period)) throw new Error(PERIOD_ERROR);
        const key = `${packId}:${entry.period}`;
        if (seen.has(key)) throw new Error('A pack can only have one rate per period');
        seen.add(key);
        return { packId, period: entry.period, rate: parseRate('Pack rate', entry.rate) };
    });
};

export interface AgentRates {
    monthlyRate: number;
    semiannualRate: number;
    yearlyRate: number;
}

export interface NewAgentData extends AgentRates {
    name: string;
    email: string;
    password: string;
    phone?: string;
    code: string;
    packRates: PackRateData[];
}

export const sanitizeNewAgent = (input: Record<string, unknown>): NewAgentData => {
    if (input.commissionRate !== undefined) throw new Error(LEGACY_RATE_ERROR);
    const password = typeof input.password === 'string' ? input.password : '';
    if (password.length < 8) throw new Error('Password must be at least 8 characters');
    const name = requireText('Name', input.name);
    const email = sanitizeEmail(input.email);
    return {
        name,
        email,
        password,
        phone: optionalText(input.phone),
        code: sanitizeCode(input.code),
        monthlyRate: parseRate('Monthly rate', input.monthlyRate),
        semiannualRate: parseRate('Semi-annual rate', input.semiannualRate),
        yearlyRate: parseRate('Yearly rate', input.yearlyRate),
        packRates: input.packRates === undefined || input.packRates === null ? [] : sanitizePackRates(input.packRates),
    };
};

export interface AgentUpdateData {
    name?: string;
    phone?: string | null;
    monthlyRate?: number;
    semiannualRate?: number;
    yearlyRate?: number;
    packRates?: PackRateData[];
    active?: boolean;
}

export const sanitizeAgentUpdate = (input: Record<string, unknown>): AgentUpdateData => {
    if (input.code !== undefined) throw new Error('The code cannot be changed');
    if (input.isHouse !== undefined) throw new Error('The company flag cannot be changed');
    if (input.commissionRate !== undefined) throw new Error(LEGACY_RATE_ERROR);
    const data: AgentUpdateData = {};
    if (input.name !== undefined) data.name = requireText('Name', input.name);
    if (input.phone !== undefined) data.phone = optionalText(input.phone) ?? null;
    if (input.monthlyRate !== undefined) data.monthlyRate = parseRate('Monthly rate', input.monthlyRate);
    if (input.semiannualRate !== undefined) data.semiannualRate = parseRate('Semi-annual rate', input.semiannualRate);
    if (input.yearlyRate !== undefined) data.yearlyRate = parseRate('Yearly rate', input.yearlyRate);
    // Replaces the whole list when present.
    if (input.packRates !== undefined) data.packRates = input.packRates === null ? [] : sanitizePackRates(input.packRates);
    if (input.active !== undefined) {
        if (typeof input.active !== 'boolean') throw new Error('Active must be true or false');
        data.active = input.active;
    }
    return data;
};

export interface RateSource extends AgentRates {
    packRates: { packId: string; period: string; rate: number }[];
}

export const baseRate = (rates: AgentRates, period: PeriodValue): number =>
    period === 'MONTHLY' ? rates.monthlyRate : period === 'SEMIANNUAL' ? rates.semiannualRate : rates.yearlyRate;

// The rate frozen on a payment: the agent's exception for (school pack, period) if any, else the base rate
// of the period. No agent earns 0; a school without a pack uses the base rate.
export const resolveCommissionRate = (
    agent: RateSource | null | undefined,
    packId: string | null | undefined,
    period: PeriodValue
): number => {
    if (!agent) return 0;
    const exception = packId ? agent.packRates.find((rate) => rate.packId === packId && rate.period === period) : undefined;
    return exception ? exception.rate : baseRate(agent, period);
};

export interface PaymentData {
    amount: number;
    period: PeriodValue;
    paidAt: Date;
    note?: string;
}

export const sanitizePayment = (input: Record<string, unknown>): PaymentData => {
    const amount = parseAmount(input.amount);
    if (!isPeriod(input.period)) throw new Error(PERIOD_ERROR);
    return {
        amount,
        period: input.period,
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

export const PAYOUT_METHODS = ['BANK_TRANSFER', 'MONEY_TRANSFER', 'MOBILE_MONEY', 'CASH'] as const;
export type PayoutMethodValue = (typeof PAYOUT_METHODS)[number];

export const WALLET_PROVIDERS = ['INWI_MONEY', 'ORANGE_MONEY'] as const;
export type WalletProviderValue = (typeof WALLET_PROVIDERS)[number];

const SELF_FIELDS = ['phone', 'avatar', 'payoutMethod', 'bankName', 'rib', 'accountHolder', 'payoutPhone', 'walletProvider'] as const;
const PAYOUT_DETAIL_FIELDS = ['bankName', 'rib', 'accountHolder', 'payoutPhone', 'walletProvider'] as const;

export interface AgentSelfUpdateData {
    phone?: string | null;
    avatar?: string | null;
    payoutMethod?: PayoutMethodValue | null;
    bankName?: string | null;
    rib?: string | null;
    accountHolder?: string | null;
    payoutPhone?: string | null;
    walletProvider?: WalletProviderValue | null;
}

// What an agent may change on their own profile: phone and payout method. Everything else is admin-only.
// A payout update is always complete: the fields of the other methods are cleared.
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,/;
const AVATAR_MAX_LENGTH = 700_000;

const sanitizeAvatar = (value: unknown): string | null => {
    if (value === null || value === '') return null;
    if (typeof value !== 'string' || value.length > AVATAR_MAX_LENGTH || !AVATAR_PATTERN.test(value)) {
        throw new Error('Photo must be a PNG, JPEG or WEBP image under 500 KB');
    }
    return value;
};

export const sanitizeAgentSelfUpdate = (input: Record<string, unknown>): AgentSelfUpdateData => {
    if (Object.keys(input).some((key) => !(SELF_FIELDS as readonly string[]).includes(key))) {
        throw new Error('This field can only be changed by an administrator');
    }
    const data: AgentSelfUpdateData = {};
    if (input.phone !== undefined) data.phone = optionalText(input.phone) ?? null;
    if (input.avatar !== undefined) data.avatar = sanitizeAvatar(input.avatar);

    const hasDetails = PAYOUT_DETAIL_FIELDS.some((field) => input[field] !== undefined);
    if (input.payoutMethod === undefined) {
        if (hasDetails) throw new Error('Payout method is required');
    } else {
        const method = input.payoutMethod;
        const cleared = { bankName: null, rib: null, accountHolder: null, payoutPhone: null, walletProvider: null };
        if (method === null) {
            Object.assign(data, { payoutMethod: null, ...cleared });
        } else if (!PAYOUT_METHODS.includes(method as PayoutMethodValue)) {
            throw new Error('Payout method must be BANK_TRANSFER, MONEY_TRANSFER, MOBILE_MONEY or CASH');
        } else if (method === 'BANK_TRANSFER') {
            const rib = typeof input.rib === 'string' ? input.rib.replace(/\s+/g, '') : '';
            const bankName = requireText('Bank name', input.bankName);
            const accountHolder = requireText('Account holder', input.accountHolder);
            if (!/^\d{24}$/.test(rib)) throw new Error('RIB must be exactly 24 digits');
            Object.assign(data, { payoutMethod: method, ...cleared, bankName, accountHolder, rib });
        } else if (method === 'MONEY_TRANSFER') {
            const accountHolder = requireText('Account holder', input.accountHolder);
            const payoutPhone = requireText('Payout phone', input.payoutPhone);
            Object.assign(data, { payoutMethod: method, ...cleared, accountHolder, payoutPhone });
        } else if (method === 'MOBILE_MONEY') {
            const walletProvider = input.walletProvider;
            if (!WALLET_PROVIDERS.includes(walletProvider as WalletProviderValue)) {
                throw new Error('Wallet provider must be INWI_MONEY or ORANGE_MONEY');
            }
            const accountHolder = requireText('Account holder', input.accountHolder);
            const payoutPhone = requireText('Payout phone', input.payoutPhone);
            Object.assign(data, { payoutMethod: method, ...cleared, walletProvider, accountHolder, payoutPhone });
        } else {
            Object.assign(data, { payoutMethod: method, ...cleared });
        }
    }
    if (Object.keys(data).length === 0) throw new Error('Nothing to update');
    return data;
};

export const sanitizeEmail = (value: unknown): string => {
    const email = requireText('Email', value).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email is invalid');
    return email;
};

export const sanitizeNewPassword = (value: unknown): string => {
    if (typeof value !== 'string' || value.length < 8) throw new Error('Password must be at least 8 characters');
    return value;
};
