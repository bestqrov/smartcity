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

const room = (max: number | null | undefined) => (max === null || max === undefined ? Infinity : max);

export const UPGRADE_REASONS = ['STUDENT_LIMIT', 'BRANCH_LIMIT'] as const;
export type UpgradeReason = (typeof UPGRADE_REASONS)[number];

// The school moves itself to a pricier pack of its type that still holds its current students and branches. The pack applies at once; an ACTIVE school gets
// one month to pay, a school on trial pays for it when the trial ends (no deadline).
export const upgradeSchoolPack = async (branchId: string, userId: string, packCode: unknown, reason?: unknown) => {
    const upgradeReason: UpgradeReason = UPGRADE_REASONS.includes(reason as UpgradeReason) ? (reason as UpgradeReason) : 'STUDENT_LIMIT';
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
        const branchCount = await tx.branch.count({ where: { schoolId: school.id } });
        const pricier = !school.pack || pack.monthlyPrice > school.pack.monthlyPrice;
        const holdsUsage = room(pack.maxStudents) >= capacity.current && room(pack.maxBranches) >= branchCount;
        if (!pricier || !holdsUsage) {
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
                reason: upgradeReason,
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
