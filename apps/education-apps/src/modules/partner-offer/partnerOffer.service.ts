import type { PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { resolveReferralCode } from '../sales-agents/salesAgents.service';

type Period = 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';

export const OFFER_KEY = 'default';

export const DEFAULT_PARTNER_OFFER = {
    key: OFFER_KEY,
    active: true,
    monthlyPrice: 120,
    semiannualPrice: 1299,
    yearlyPrice: 2000,
};

// Idempotent: never overwrites prices a SUPER_ADMIN has edited.
export const seedPartnerOffer = async (client: PrismaClient) => {
    const existing = await client.partnerOffer.findUnique({ where: { key: OFFER_KEY } });
    if (existing) return existing;
    return client.partnerOffer.create({ data: DEFAULT_PARTNER_OFFER });
};

export const offerPriceFor = (
    offer: { monthlyPrice: number; semiannualPrice: number; yearlyPrice: number },
    period: Period
): number => {
    if (period === 'MONTHLY') return offer.monthlyPrice;
    if (period === 'SEMIANNUAL') return offer.semiannualPrice;
    return offer.yearlyPrice;
};

// The stored offer if the visitor's code gives access to it: offer active AND the code belongs to an
// active agent who is not the house agent. Any unusable code simply means "not eligible".
export const resolvePartnerOffer = async (rawCode: unknown) => {
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
    return offer;
};

// Public: prices are shown whenever the offer is active (landing teaser); `eligible` is true only when the
// code also belongs to an active non-house agent. Never reveals who the agent is.
export const getPartnerOfferFor = async (rawCode: unknown) => {
    const stored = await prisma.partnerOffer.findUnique({ where: { key: OFFER_KEY } });
    if (!stored || !stored.active) return { eligible: false };
    const eligible = (await resolvePartnerOffer(rawCode)) !== null;
    return {
        eligible,
        offer: { monthlyPrice: stored.monthlyPrice, semiannualPrice: stored.semiannualPrice, yearlyPrice: stored.yearlyPrice },
    };
};

export const getAdminPartnerOffer = async () => {
    const offer = await prisma.partnerOffer.findUnique({ where: { key: OFFER_KEY } });
    return offer ?? DEFAULT_PARTNER_OFFER;
};

export const updatePartnerOffer = async (input: Record<string, unknown>) => {
    if (typeof input.active !== 'boolean') throw new Error('active must be a boolean');
    const prices: Record<string, number> = {};
    for (const key of ['monthlyPrice', 'semiannualPrice', 'yearlyPrice']) {
        const value = input[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
            throw new Error(`${key} must be a number greater than 0`);
        }
        prices[key] = value;
    }
    const data = { active: input.active, ...prices };
    return prisma.partnerOffer.upsert({ where: { key: OFFER_KEY }, update: data, create: { key: OFFER_KEY, ...data } as any });
};
