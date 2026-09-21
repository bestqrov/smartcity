import type { PrismaClient } from '@prisma/client';
import { INSTITUTION_TYPES, type InstitutionTypeValue, type PackFeature } from './packs.constants';

interface SeedPack {
    code: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionTypeValue[];
    sortOrder: number;
}

type Tier = 'essentiel' | 'pro' | 'premium';

const TIERS: { tier: Tier; name: string; maxBranches: number | null }[] = [
    { tier: 'essentiel', name: 'Essentiel', maxBranches: 1 },
    { tier: 'pro', name: 'Pro', maxBranches: 2 },
    { tier: 'premium', name: 'Premium', maxBranches: null },
];

const BASE_FEATURES: PackFeature[] = [
    'PARENT_PORTAL',
    'STUDENT_PORTAL',
    'QR_ATTENDANCE',
    'ANNOUNCEMENTS',
    'FINANCE_ANALYTICS',
];

interface TypePricing {
    type: InstitutionTypeValue;
    codeSuffix: string; // '' keeps the original codes (essentiel / pro / premium) for private schools
    monthly: [number, number, number]; // essentiel, pro, premium (MAD)
    students: [number, number, null]; // student limits; Premium is unlimited
    transport: boolean; // whether Premium includes TRANSPORT
}

const TYPE_PRICING: TypePricing[] = [
    { type: 'PRIVATE_SCHOOL', codeSuffix: '', monthly: [250, 400, 800], students: [100, 300, null], transport: true },
    { type: 'TUTORING_CENTER', codeSuffix: '-soutien', monthly: [200, 350, 600], students: [150, 400, null], transport: false },
    { type: 'VOCATIONAL_TRAINING', codeSuffix: '-formation', monthly: [300, 500, 900], students: [80, 250, null], transport: false },
    { type: 'LANGUAGE_CENTER', codeSuffix: '-langues', monthly: [200, 350, 650], students: [120, 350, null], transport: false },
];

const featuresFor = (tier: Tier, transport: boolean): PackFeature[] => {
    if (tier === 'essentiel') return [];
    if (tier === 'pro' || !transport) return [...BASE_FEATURES];
    return [...BASE_FEATURES, 'TRANSPORT'];
};

// Yearly price = 10 months (two months free).
export const DEFAULT_PACKS: SeedPack[] = [
    ...TYPE_PRICING.flatMap((config) =>
        TIERS.map((tier, index) => ({
            code: `${tier.tier}${config.codeSuffix}`,
            name: tier.name,
            monthlyPrice: config.monthly[index],
            yearlyPrice: config.monthly[index] * 10,
            maxStudents: config.students[index],
            maxBranches: tier.maxBranches,
            features: featuresFor(tier.tier, config.transport),
            institutionTypes: [config.type],
            sortOrder: index + 1,
        }))
    ),
    {
        code: 'creche',
        name: 'Crèche',
        monthlyPrice: 200,
        yearlyPrice: 2000,
        maxStudents: 40,
        maxBranches: 1,
        features: ['PARENT_PORTAL', 'DAILY_LOG'],
        institutionTypes: ['CRECHE'],
        sortOrder: 1,
    },
];

// The pack that is the default of each institution type when no default exists yet.
export const DEFAULT_PACK_BY_TYPE: Record<InstitutionTypeValue, string> = {
    PRIVATE_SCHOOL: 'pro',
    TUTORING_CENTER: 'pro-soutien',
    VOCATIONAL_TRAINING: 'pro-formation',
    LANGUAGE_CENTER: 'pro-langues',
    CRECHE: 'creche',
};

// essentiel/pro/premium were first seeded for these four types before packs became per-type.
const ORIGINAL_SHARED_TYPES: InstitutionTypeValue[] = [
    'PRIVATE_SCHOOL',
    'TUTORING_CENTER',
    'VOCATIONAL_TRAINING',
    'LANGUAGE_CENTER',
];

// Idempotent: existing packs are never overwritten (a Super Admin may have edited them), each type gets its
// default pack only if it has none, and legacy schools are backfilled to PRIVATE_SCHOOL + their type's default.
export const seedPacks = async (client: PrismaClient) => {
    // One-time normalisation, only while the types still equal the original shared list exactly.
    await client.pack.updateMany({
        where: { code: { in: ['essentiel', 'pro', 'premium'] }, institutionTypes: { equals: ORIGINAL_SHARED_TYPES } },
        data: { institutionTypes: ['PRIVATE_SCHOOL'] },
    });

    for (const pack of DEFAULT_PACKS) {
        await client.pack.upsert({
            where: { code: pack.code },
            update: {},
            create: { ...pack, isDefault: false, active: true },
        });
    }

    for (const type of INSTITUTION_TYPES) {
        const hasDefault = await client.pack.count({ where: { isDefault: true, institutionTypes: { has: type } } });
        if (hasDefault === 0) {
            await client.pack.update({ where: { code: DEFAULT_PACK_BY_TYPE[type] }, data: { isDefault: true } });
        }
    }

    await client.school.updateMany({
        where: { OR: [{ institutionType: null }, { institutionType: { isSet: false } }] },
        data: { institutionType: 'PRIVATE_SCHOOL' },
    });

    for (const type of INSTITUTION_TYPES) {
        const defaultPack = await client.pack.findFirst({
            where: { isDefault: true, active: true, institutionTypes: { has: type } },
        });
        if (defaultPack) {
            await client.school.updateMany({
                where: { OR: [{ packId: null }, { packId: { isSet: false } }], institutionType: type },
                data: { packId: defaultPack.id },
            });
        }
    }
};
