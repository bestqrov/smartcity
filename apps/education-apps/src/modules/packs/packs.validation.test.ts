import { sanitizeNewPack, sanitizePackUpdate } from './packs.validation';

const valid = {
    name: ' Pro ',
    code: ' PRO ',
    monthlyPrice: 400,
    yearlyPrice: 4000,
    maxStudents: 300,
    maxBranches: 2,
    features: ['PARENT_PORTAL', 'PARENT_PORTAL', 'QR_ATTENDANCE'],
    institutionTypes: ['PRIVATE_SCHOOL', 'PRIVATE_SCHOOL', 'TUTORING_CENTER'],
};

describe('sanitizeNewPack', () => {
    it('trims, lowercases the code and collapses duplicate features and types', () => {
        expect(sanitizeNewPack(valid)).toEqual({
            name: 'Pro',
            code: 'pro',
            monthlyPrice: 400,
            yearlyPrice: 4000,
            maxStudents: 300,
            maxBranches: 2,
            features: ['PARENT_PORTAL', 'QR_ATTENDANCE'],
            institutionTypes: ['PRIVATE_SCHOOL', 'TUTORING_CENTER'],
        });
    });

    it('defaults omitted limits to null (unlimited) and features to required', () => {
        const { maxStudents, maxBranches, ...rest } = valid;
        expect(sanitizeNewPack(rest)).toEqual(expect.objectContaining({ maxStudents: null, maxBranches: null }));
        const { features, ...noFeatures } = valid;
        expect(() => sanitizeNewPack(noFeatures)).toThrow('features is required');
    });

    it('requires name and code', () => {
        expect(() => sanitizeNewPack({ ...valid, name: ' ' })).toThrow('name is required');
        const { code, ...noCode } = valid;
        expect(() => sanitizeNewPack(noCode)).toThrow('code is required');
    });

    it('rejects a code with invalid characters', () => {
        expect(() => sanitizeNewPack({ ...valid, code: 'Pro Plus' })).toThrow(
            'code must contain only lowercase letters, digits and dashes'
        );
    });

    it('rejects negative, non-numeric or non-finite prices', () => {
        for (const bad of [-1, '10', NaN, Infinity]) {
            expect(() => sanitizeNewPack({ ...valid, monthlyPrice: bad })).toThrow(
                'monthlyPrice must be a number greater than or equal to 0'
            );
        }
    });

    it('rejects limits that are neither null nor a positive integer', () => {
        for (const bad of [0, -3, 2.5, '5']) {
            expect(() => sanitizeNewPack({ ...valid, maxStudents: bad })).toThrow(
                'maxStudents must be null or a positive integer'
            );
        }
        expect(sanitizeNewPack({ ...valid, maxStudents: null }).maxStudents).toBeNull();
    });

    it('rejects an unknown feature key', () => {
        expect(() => sanitizeNewPack({ ...valid, features: ['NOPE'] })).toThrow('features contains an unknown feature');
    });

    it('requires a non-empty list of valid institution types', () => {
        expect(() => sanitizeNewPack({ ...valid, institutionTypes: [] })).toThrow(
            'institutionTypes must be a non-empty list of valid institution types'
        );
        expect(() => sanitizeNewPack({ ...valid, institutionTypes: ['UNIVERSITY'] })).toThrow(
            'institutionTypes must be a non-empty list of valid institution types'
        );
    });

    it('validates optional active and sortOrder', () => {
        expect(sanitizeNewPack({ ...valid, active: false, sortOrder: 3 })).toEqual(
            expect.objectContaining({ active: false, sortOrder: 3 })
        );
        expect(() => sanitizeNewPack({ ...valid, active: 'yes' })).toThrow('active must be a boolean');
        expect(() => sanitizeNewPack({ ...valid, sortOrder: 1.5 })).toThrow('sortOrder must be an integer');
    });
});

describe('sanitizePackUpdate', () => {
    it('returns only the provided fields, validated', () => {
        expect(sanitizePackUpdate({ monthlyPrice: 450 })).toEqual({ monthlyPrice: 450 });
        expect(sanitizePackUpdate({})).toEqual({});
    });

    it('applies the same validation to provided fields', () => {
        expect(() => sanitizePackUpdate({ code: 'Bad Code' })).toThrow('code must contain only');
        expect(() => sanitizePackUpdate({ features: ['NOPE'] })).toThrow('features contains an unknown feature');
        expect(sanitizePackUpdate({ maxBranches: null })).toEqual({ maxBranches: null });
    });
});
