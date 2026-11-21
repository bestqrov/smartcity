import type { PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { resolveReferralCode } from '../sales-agents/salesAgents.service';

export type Period = 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';

export const OFFER_KEY = 'default';

export interface OfferDiscounts {
    monthlyDiscount: number;
    semiannualDiscount: number;
    yearlyDiscount: number;
}

export const DEFAULT_DISCOUNTS: OfferDiscounts = { monthlyDiscount: 15, semiannualDiscount: 18, yearlyDiscount: 20 };

export const DEFAULT_PARTNER_OFFER = { key: OFFER_KEY, active: true, ...DEFAULT_DISCOUNTS };

const DISCOUNT_KEYS = ['monthlyDiscount', 'semiannualDiscount', 'yearlyDiscount'] as const;

// Stored documents may predate the discounts (legacy flat-price offer): fill any gap with the defaults.
export const discountsOf = (stored: Partial<Record<keyof OfferDiscounts, number | null>>): OfferDiscounts => ({
    monthlyDiscount: stored.monthlyDiscount ?? DEFAULT_DISCOUNTS.monthlyDiscount,
    semiannualDiscount: stored.semiannualDiscount ?? DEFAULT_DISCOUNTS.semiannualDiscount,
    yearlyDiscount: stored.yearlyDiscount ?? DEFAULT_DISCOUNTS.yearlyDiscount,
});

// Idempotent: never overwrites discounts a SUPER_ADMIN has edited.
export const seedPartnerOffer = async (client: PrismaClient) => {
    const existing = await client.partnerOffer.findUnique({ where: { key: OFFER_KEY } });
    if (existing) return existing;
    return client.partnerOffer.create({ data: DEFAULT_PARTNER_OFFER });
};

export const discountFor = (discounts: OfferDiscounts, period: Period): number =>
    period === 'MONTHLY' ? discounts.monthlyDiscount : period === 'SEMIANNUAL' ? discounts.semiannualDiscount : discounts.yearlyDiscount;

// Full pack price for the period: 6 months is six monthly payments, a year is the pack's yearly price.
export const packBasePrice = (pack: { monthlyPrice: number; yearlyPrice: number }, period: Period): number =>
    period === 'MONTHLY' ? pack.monthlyPrice : period === 'SEMIANNUAL' ? pack.monthlyPrice * 6 : pack.yearlyPrice;

const round2 = (value: number) => Math.round(value * 100) / 100;

export const offerPriceFor = (pack: { monthlyPrice: number; yearlyPrice: number }, discounts: OfferDiscounts, period: Period): number =>
    round2(packBasePrice(pack, period) * (1 - discountFor(discounts, period) / 100));

// The offer's discounts if the visitor's code gives access to it: offer active AND the code belongs to an
// active agent who is not the house agent. Any unusable code simply means "not eligible".
export const resolvePartnerOffer = async (rawCode: unknown): Promise<OfferDiscounts | null> => {
    let agent;
    try {
        agent = await resolveReferralCode(rawCode);
    } catch (error) {
        if (error instanceof Error && (error.message === 'Referral code is required' || error.message === 'Invalid referral code')) {
            return null;
        }
        throw error;
    }
    if (agent.isHouse) return null;
    const offer = await prisma.partnerOffer.findUnique({ where: { key: OFFER_KEY } });
    if (!offer || !offer.active) return null;
    return discountsOf(offer);
};

// Public: discounts are shown whenever the offer is active (landing teaser); `eligible` is true only when the
// code also belongs to an active non-house agent. Never reveals who the agent is.
export const getPartnerOfferFor = async (rawCode: unknown) => {
    const stored = await prisma.partnerOffer.findUnique({ where: { key: OFFER_KEY } });
    if (!stored || !stored.active) return { eligible: false };
    const eligible = (await resolvePartnerOffer(rawCode)) !== null;
    return { eligible, offer: discountsOf(stored) };
};

export const getAdminPartnerOffer = async () => {
    const offer = await prisma.partnerOffer.findUnique({ where: { key: OFFER_KEY } });
    return offer ? { active: offer.active, ...discountsOf(offer) } : { active: DEFAULT_PARTNER_OFFER.active, ...DEFAULT_DISCOUNTS };
};

export const updatePartnerOffer = async (input: Record<string, unknown>) => {
    if (typeof input.active !== 'boolean') throw new Error('active must be a boolean');
    const discounts: Record<string, number> = {};
    for (const key of DISCOUNT_KEYS) {
        const value = input[key];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 90) {
            throw new Error(`${key} must be a whole number between 0 and 90`);
        }
        discounts[key] = value;
    }
    const data = { active: input.active, ...discounts };
    const saved = await prisma.partnerOffer.upsert({ where: { key: OFFER_KEY }, update: data, create: { key: OFFER_KEY, ...data } });
    return { active: saved.active, ...discountsOf(saved) };
};
