import prisma from '../../config/database';
import { TransportPricingMode } from '../transport/pricing';
import { CYCLES, isCycle } from '../school-mode/levels';

interface UpdateSettingsData {
    schoolName?: string;
    logo?: string;
    academicYear?: string;
    contactInfo?: string;
    transportPricingMode?: TransportPricingMode;
    transportUniformPrice?: number | null;
    gradingPeriods?: string[];
    schoolCycles?: string[];
    schoolYear?: string | null;
}

// The complete private school mode exists for private schools only (null type = private school).
export const validateSchoolCycles = (value: unknown, institutionType: string | null | undefined): string[] => {
    if (!Array.isArray(value) || !value.every(isCycle)) {
        throw new Error('schoolCycles must be a list of PRESCOLAIRE, PRIMAIRE, COLLEGE, LYCEE');
    }
    if (value.length > 0 && institutionType && institutionType !== 'PRIVATE_SCHOOL') {
        throw new Error('School cycles are only for a private school');
    }
    return CYCLES.filter((cycle) => value.includes(cycle));
};

const MAX_PERIODS = 6;
const MAX_PERIOD_NAME = 30;

/** 1 to 6 distinct, non-empty names of at most 30 characters (trimmed). */
export const validateGradingPeriods = (value: unknown): string[] => {
    const error = new Error(`gradingPeriods must be 1 to ${MAX_PERIODS} distinct non-empty names of at most ${MAX_PERIOD_NAME} characters`);
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PERIODS) throw error;
    const names = value.map((v) => (typeof v === 'string' ? v.trim() : ''));
    if (names.some((n) => n.length < 1 || n.length > MAX_PERIOD_NAME)) throw error;
    if (new Set(names).size !== names.length) throw error;
    return names;
};

export const getSettings = async (branchId: string) => {
    return prisma.settings.upsert({
        where: { branchId },
        update: {},
        create: {
            branchId,
            schoolName: 'School Name',
            academicYear: '2024-2025',
            logo: null,
            contactInfo: null,
        },
    });
};

export const updateSettings = async (branchId: string, data: UpdateSettingsData) => {
    return prisma.settings.upsert({
        where: { branchId },
        update: data,
        create: {
            branchId,
            schoolName: data.schoolName || 'School Name',
            academicYear: data.academicYear || '2024-2025',
            logo: data.logo || null,
            contactInfo: data.contactInfo || null,
            ...(data.transportPricingMode !== undefined && { transportPricingMode: data.transportPricingMode }),
            ...(data.transportUniformPrice !== undefined && { transportUniformPrice: data.transportUniformPrice }),
            ...(data.gradingPeriods !== undefined && { gradingPeriods: data.gradingPeriods }),
            ...(data.schoolCycles !== undefined && { schoolCycles: data.schoolCycles }),
            ...(data.schoolYear !== undefined && { schoolYear: data.schoolYear }),
        },
    });
};
