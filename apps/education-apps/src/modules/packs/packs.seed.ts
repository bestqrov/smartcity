import type { PrismaClient } from '@prisma/client';
import type { InstitutionTypeValue, PackFeature } from './packs.constants';

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

const GENERAL_TYPES: InstitutionTypeValue[] = [
    'PRIVATE_SCHOOL',
    'TUTORING_CENTER',
    'VOCATIONAL_TRAINING',
    'LANGUAGE_CENTER',
];

export const DEFAULT_PACKS: SeedPack[] = [
    {
        code: 'essentiel',
        name: 'Essentiel',
        monthlyPrice: 250,
        yearlyPrice: 2500,
        maxStudents: 100,
        maxBranches: 1,
        features: [],
        institutionTypes: GENERAL_TYPES,
        sortOrder: 1,
    },
    {
        code: 'pro',
        name: 'Pro',
        monthlyPrice: 400,
        yearlyPrice: 4000,
        maxStudents: 300,
        maxBranches: 2,
        features: ['PARENT_PORTAL', 'STUDENT_PORTAL', 'QR_ATTENDANCE', 'ANNOUNCEMENTS', 'FINANCE_ANALYTICS'],
        institutionTypes: GENERAL_TYPES,
        sortOrder: 2,
    },
    {
        code: 'premium',
        name: 'Premium',
        monthlyPrice: 800,
        yearlyPrice: 8000,
        maxStudents: null,
        maxBranches: null,
        features: [
            'PARENT_PORTAL',
            'STUDENT_PORTAL',
            'QR_ATTENDANCE',
            'ANNOUNCEMENTS',
            'FINANCE_ANALYTICS',
            'TRANSPORT',
        ],
        institutionTypes: GENERAL_TYPES,
        sortOrder: 3,
    },
    {
        code: 'creche',
        name: 'Crèche',
        monthlyPrice: 200,
        yearlyPrice: 2000,
        maxStudents: 40,
        maxBranches: 1,
        features: ['PARENT_PORTAL', 'DAILY_LOG'],
        institutionTypes: ['CRECHE'],
        sortOrder: 4,
    },
];

// Idempotent: existing packs are never overwritten (a Super Admin may have edited them), Pro becomes
// the default only if no default exists, and legacy schools are backfilled to PRIVATE_SCHOOL + the default pack.
export const seedPacks = async (client: PrismaClient) => {
    for (const pack of DEFAULT_PACKS) {
        await client.pack.upsert({
            where: { code: pack.code },
            update: {},
            create: { ...pack, isDefault: false, active: true },
        });
    }

    if ((await client.pack.count({ where: { isDefault: true } })) === 0) {
        await client.pack.update({ where: { code: 'pro' }, data: { isDefault: true } });
    }

    await client.school.updateMany({
        where: { OR: [{ institutionType: null }, { institutionType: { isSet: false } }] },
        data: { institutionType: 'PRIVATE_SCHOOL' },
    });

    const defaultPack = await client.pack.findFirst({ where: { isDefault: true, active: true } });
    if (defaultPack) {
        await client.school.updateMany({
            where: { OR: [{ packId: null }, { packId: { isSet: false } }], institutionType: 'PRIVATE_SCHOOL' },
            data: { packId: defaultPack.id },
        });
    }
};
