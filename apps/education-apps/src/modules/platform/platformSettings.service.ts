import prisma from '../../config/database';

export const SETTINGS_KEY = 'default';

export const SIGNUP_PERIODS = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'] as const;
export type SignupPeriod = (typeof SIGNUP_PERIODS)[number];

export interface PlatformSettingsValues {
    trialDays: number;
    signupOpen: boolean;
    signupPeriods: SignupPeriod[];
    platformName: string;
    supportPhone: string | null;
    supportWhatsapp: string | null;
    supportEmail: string | null;
    bannerText: string | null;
    bannerActive: boolean;
}

// The values that were hardcoded before the settings existed: nothing changes until the super admin saves.
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsValues & { key: string } = {
    key: SETTINGS_KEY,
    trialDays: 15,
    signupOpen: true,
    signupPeriods: [...SIGNUP_PERIODS],
    platformName: 'ArwaEduc',
    supportPhone: '+212 608183886',
    supportWhatsapp: '212608183886',
    supportEmail: 'contact@smartecole.com',
    bannerText: null,
    bannerActive: false,
};

const pick = (stored: PlatformSettingsValues): PlatformSettingsValues => ({
    trialDays: stored.trialDays,
    signupOpen: stored.signupOpen,
    signupPeriods: stored.signupPeriods,
    platformName: stored.platformName,
    supportPhone: stored.supportPhone ?? null,
    supportWhatsapp: stored.supportWhatsapp ?? null,
    supportEmail: stored.supportEmail ?? null,
    bannerText: stored.bannerText ?? null,
    bannerActive: stored.bannerActive,
});

// The singleton, created with the defaults on first read.
export const getPlatformSettings = async (): Promise<PlatformSettingsValues> => {
    const existing = await prisma.platformSettings.findUnique({ where: { key: SETTINGS_KEY } });
    if (existing) return pick(existing);
    try {
        return pick(await prisma.platformSettings.create({ data: DEFAULT_PLATFORM_SETTINGS }));
    } catch (error) {
        // Two first reads at once: the other one created it.
        if ((error as { code?: string })?.code === 'P2002') {
            const again = await prisma.platformSettings.findUnique({ where: { key: SETTINGS_KEY } });
            if (again) return pick(again);
        }
        throw error;
    }
};

// What anyone may read (login and signup pages): no banner.
export const getPublicPlatformSettings = async () => {
    const s = await getPlatformSettings();
    return {
        platformName: s.platformName,
        supportPhone: s.supportPhone,
        supportWhatsapp: s.supportWhatsapp,
        supportEmail: s.supportEmail,
        signupOpen: s.signupOpen,
        signupPeriods: s.signupPeriods,
        trialDays: s.trialDays,
    };
};

// The banner for school staff dashboards: text only when active and not empty.
export const getPlatformBanner = async () => {
    const s = await getPlatformSettings();
    const text = s.bannerActive && s.bannerText?.trim() ? s.bannerText.trim() : null;
    return { text };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s.-]{5,19}$/;

const optionalText = (input: Record<string, unknown>, field: string, max: number, check?: (v: string) => boolean): string | null | undefined => {
    if (!(field in input)) return undefined;
    const value = input[field];
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw new Error(`${field} must be a string`);
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > max) throw new Error(`${field} is too long`);
    if (check && !check(trimmed)) throw new Error(`${field} is invalid`);
    return trimmed;
};

// Validates a partial update; unknown fields are ignored.
export const validatePlatformSettings = (input: Record<string, unknown>): Partial<PlatformSettingsValues> => {
    const data: Partial<PlatformSettingsValues> = {};

    if ('trialDays' in input) {
        const days = input.trialDays;
        if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 90) {
            throw new Error('trialDays must be an integer between 1 and 90');
        }
        data.trialDays = days;
    }
    if ('signupOpen' in input) {
        if (typeof input.signupOpen !== 'boolean') throw new Error('signupOpen must be a boolean');
        data.signupOpen = input.signupOpen;
    }
    if ('signupPeriods' in input) {
        const periods = input.signupPeriods;
        if (!Array.isArray(periods) || periods.length === 0 || !periods.every((p) => (SIGNUP_PERIODS as readonly unknown[]).includes(p))) {
            throw new Error('signupPeriods must be a non-empty list of MONTHLY, SEMIANNUAL, YEARLY');
        }
        // Kept in the canonical order, without duplicates.
        data.signupPeriods = SIGNUP_PERIODS.filter((p) => periods.includes(p));
    }
    if ('platformName' in input) {
        const name = optionalText(input, 'platformName', 60);
        if (!name) throw new Error('platformName is required');
        data.platformName = name;
    }
    const phone = optionalText(input, 'supportPhone', 20, (v) => PHONE_RE.test(v));
    if (phone !== undefined) data.supportPhone = phone;
    const whatsapp = optionalText(input, 'supportWhatsapp', 20, (v) => PHONE_RE.test(v));
    if (whatsapp !== undefined) data.supportWhatsapp = whatsapp;
    const email = optionalText(input, 'supportEmail', 120, (v) => EMAIL_RE.test(v));
    if (email !== undefined) data.supportEmail = email?.toLowerCase() ?? null;
    const banner = optionalText(input, 'bannerText', 300);
    if (banner !== undefined) data.bannerText = banner;
    if ('bannerActive' in input) {
        if (typeof input.bannerActive !== 'boolean') throw new Error('bannerActive must be a boolean');
        data.bannerActive = input.bannerActive;
    }
    return data;
};

export const updatePlatformSettings = async (input: Record<string, unknown>) => {
    const data = validatePlatformSettings(input ?? {});
    const current = await getPlatformSettings();
    const next = { ...current, ...data };
    if (next.bannerActive && !next.bannerText) throw new Error('bannerText is required to show the banner');
    const saved = await prisma.platformSettings.update({ where: { key: SETTINGS_KEY }, data });
    return pick(saved);
};
