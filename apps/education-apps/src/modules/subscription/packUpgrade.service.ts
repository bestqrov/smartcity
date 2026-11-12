import prisma from '../../config/database';
import { DEFAULT_INSTITUTION_TYPE } from '../packs/packs.constants';
import { getSchoolCapacity } from '../packs/packs.limits';

// Same day next month, clamped to the month's last day (31 Jan -> 28/29 Feb). UTC, like every stored date.
export const addOneMonth = (date: Date): Date => {
    const result = new Date(date.getTime());
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
};

// MongoDB: an unset optional field is not matched by `null`, so "unsettled" checks both.
export const UNSETTLED = { OR: [{ settledAt: null }, { settledAt: { isSet: false } }] };

const room = (maxStudents: number | null) => (maxStudents === null ? Infinity : maxStudents);

// The school moves itself to a bigger pack of its type. The pack applies at once; an ACTIVE school gets
// one month to pay, a school on trial pays for it when the trial ends (no deadline).
export const upgradeSchoolPack = async (branchId: string, userId: string, packCode: unknown) => {
    if (typeof packCode !== 'string' || !packCode.trim()) throw new Error('Pack code is required');
    const capacity = await getSchoolCapacity(branchId);

    return prisma.$transaction(async (tx) => {
        const school = await tx.school.findUnique({ where: { id: capacity.schoolId }, include: { pack: true } });
        if (!school) throw new Error('School not found');

        const pack = await tx.pack.findFirst({ where: { code: packCode.trim(), active: true } });
        if (!pack) throw new Error('Pack not found');
        if (!pack.institutionTypes.includes(school.institutionType ?? DEFAULT_INSTITUTION_TYPE)) {
            throw new Error('Pack does not serve this institution type');
        }
        if (school.pack && room(pack.maxStudents) <= room(school.pack.maxStudents)) {
            throw new Error('Only an upgrade to a bigger pack is allowed');
        }

        const now = new Date();
        await tx.school.update({ where: { id: school.id }, data: { packId: pack.id } });
        const upgrade = await tx.packUpgrade.create({
            data: {
                schoolId: school.id,
                fromPackId: school.pack?.id ?? null,
                fromPackName: school.pack?.name ?? null,
                toPackId: pack.id,
                toPackName: pack.name,
                toMonthlyPrice: pack.monthlyPrice,
                byUserId: userId,
                reason: 'STUDENT_LIMIT',
                createdAt: now,
                dueAt: school.status === 'PENDING' ? null : addOneMonth(now),
                settledAt: null,
            },
        });

        return { packCode: pack.code, packName: pack.name, limit: pack.maxStudents, current: capacity.current, dueAt: upgrade.dueAt };
    });
};

export const getPendingUpgrades = async (branchId: string) => {
    const { schoolId } = await getSchoolCapacity(branchId);
    return prisma.packUpgrade.findMany({
        where: { schoolId, dueAt: { not: null }, ...UNSETTLED },
        orderBy: { createdAt: 'desc' },
        select: { id: true, toPackName: true, toMonthlyPrice: true, createdAt: true, dueAt: true },
    });
};
