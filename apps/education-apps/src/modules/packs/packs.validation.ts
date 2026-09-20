import { InstitutionTypeValue, PackFeature, isInstitutionType, isPackFeature } from './packs.constants';

export interface PackInput {
    name: string;
    code: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxStudents: number | null;
    maxBranches: number | null;
    features: PackFeature[];
    institutionTypes: InstitutionTypeValue[];
    active?: boolean;
    sortOrder?: number;
}

const CODE_RE = /^[a-z0-9-]+$/;

// `partial` = update mode: only the keys present in `input` are validated and returned.
const sanitize = (input: Record<string, any>, partial: boolean): Partial<PackInput> => {
    const out: Partial<PackInput> = {};
    const has = (key: string) => input[key] !== undefined;
    const present = (key: string): boolean => {
        if (!has(key) && !partial) throw new Error(`${key} is required`);
        return has(key);
    };

    if (present('name')) {
        if (typeof input.name !== 'string' || !input.name.trim()) throw new Error('name is required');
        out.name = input.name.trim();
    }

    if (present('code')) {
        const code = typeof input.code === 'string' ? input.code.trim().toLowerCase() : '';
        if (!CODE_RE.test(code)) throw new Error('code must contain only lowercase letters, digits and dashes');
        out.code = code;
    }

    for (const key of ['monthlyPrice', 'yearlyPrice'] as const) {
        if (present(key)) {
            const value = input[key];
            if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                throw new Error(`${key} must be a number greater than or equal to 0`);
            }
            out[key] = value;
        }
    }

    for (const key of ['maxStudents', 'maxBranches'] as const) {
        if (has(key)) {
            const value = input[key];
            if (value !== null && !(Number.isInteger(value) && value >= 1)) {
                throw new Error(`${key} must be null or a positive integer`);
            }
            out[key] = value;
        } else if (!partial) {
            out[key] = null;
        }
    }

    if (present('features')) {
        if (!Array.isArray(input.features) || !input.features.every(isPackFeature)) {
            throw new Error('features contains an unknown feature');
        }
        out.features = [...new Set<PackFeature>(input.features)];
    }

    if (present('institutionTypes')) {
        const types = input.institutionTypes;
        if (!Array.isArray(types) || types.length === 0 || !types.every(isInstitutionType)) {
            throw new Error('institutionTypes must be a non-empty list of valid institution types');
        }
        out.institutionTypes = [...new Set<InstitutionTypeValue>(types)];
    }

    if (has('active')) {
        if (typeof input.active !== 'boolean') throw new Error('active must be a boolean');
        out.active = input.active;
    }

    if (has('sortOrder')) {
        if (!Number.isInteger(input.sortOrder)) throw new Error('sortOrder must be an integer');
        out.sortOrder = input.sortOrder;
    }

    return out;
};

export const sanitizeNewPack = (input: Record<string, any>): PackInput => sanitize(input, false) as PackInput;

export const sanitizePackUpdate = (input: Record<string, any>): Partial<PackInput> => sanitize(input, true);
