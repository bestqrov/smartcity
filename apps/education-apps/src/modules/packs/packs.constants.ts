export const INSTITUTION_TYPES = [
    'PRIVATE_SCHOOL',
    'TUTORING_CENTER',
    'VOCATIONAL_TRAINING',
    'LANGUAGE_CENTER',
    'CRECHE',
] as const;

export type InstitutionTypeValue = (typeof INSTITUTION_TYPES)[number];

// A school without an institutionType (legacy documents) behaves as a private school.
export const DEFAULT_INSTITUTION_TYPE: InstitutionTypeValue = 'PRIVATE_SCHOOL';

export const PACK_FEATURES = [
    'PARENT_PORTAL',
    'STUDENT_PORTAL',
    'QR_ATTENDANCE',
    'ANNOUNCEMENTS',
    'FINANCE_ANALYTICS',
    'TRANSPORT',
    'DAILY_LOG',
] as const;

export type PackFeature = (typeof PACK_FEATURES)[number];

export const isInstitutionType = (value: unknown): value is InstitutionTypeValue =>
    typeof value === 'string' && (INSTITUTION_TYPES as readonly string[]).includes(value);

export const isPackFeature = (value: unknown): value is PackFeature =>
    typeof value === 'string' && (PACK_FEATURES as readonly string[]).includes(value);
