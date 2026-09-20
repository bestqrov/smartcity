import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { isInstitutionType } from './packs.constants';
import { sanitizeNewPack, sanitizePackUpdate } from './packs.validation';

const assertCodeFree = async (code: string) => {
    if (await prisma.pack.findUnique({ where: { code } })) {
        throw new Error('A pack with this code already exists');
    }
};

// Public catalogue for the landing page and signup: active packs only, public fields only.
export const listPublicPacks = async (type?: unknown) => {
    // `null` marks an invalid value so the check below narrows `typeFilter` to a valid type or undefined.
    const typeFilter = type === undefined ? undefined : isInstitutionType(type) ? type : null;
    if (typeFilter === null) throw new Error('Invalid institution type');

    const packs = await prisma.pack.findMany({
        where: { active: true, ...(typeFilter && { institutionTypes: { has: typeFilter } }) },
        orderBy: { sortOrder: 'asc' },
    });

    return packs.map((pack) => ({
        code: pack.code,
        name: pack.name,
        monthlyPrice: pack.monthlyPrice,
        yearlyPrice: pack.yearlyPrice,
        maxStudents: pack.maxStudents,
        maxBranches: pack.maxBranches,
        features: pack.features,
        institutionTypes: pack.institutionTypes,
        recommended: pack.isDefault,
    }));
};

export const listAllPacks = async () => {
    return prisma.pack.findMany({
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { schools: true } } },
    });
};

export const createPack = async (input: Record<string, any>) => {
    const data = sanitizeNewPack(input);
    await assertCodeFree(data.code);

    return prisma.pack.create({
        data: { ...data, isDefault: false, active: data.active ?? true, sortOrder: data.sortOrder ?? 0 },
    });
};

export const updatePack = async (id: string, input: Record<string, any>) => {
    assertId('Pack id', id);

    const existing = await prisma.pack.findUnique({ where: { id } });
    if (!existing) throw new Error('Pack not found');

    const data = sanitizePackUpdate(input);

    if (data.code !== undefined && data.code !== existing.code) await assertCodeFree(data.code);
    if (data.active === false && existing.isDefault) {
        throw new Error('The default pack cannot be deactivated; choose another default first');
    }

    return prisma.pack.update({ where: { id }, data });
};

export const setDefaultPack = async (id: string) => {
    assertId('Pack id', id);

    const pack = await prisma.pack.findUnique({ where: { id } });
    if (!pack) throw new Error('Pack not found');
    if (!pack.active) throw new Error('An inactive pack cannot be the default');

    return prisma.$transaction(async (tx) => {
        await tx.pack.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        return tx.pack.update({ where: { id }, data: { isDefault: true } });
    });
};
