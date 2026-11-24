import prisma from '../../config/database';
import { levelsOfCycles } from './levels';

export interface TuitionRow {
    level: string;
    inscriptionFee: number;
    monthlyFee: number;
    insuranceFee: number;
}

export const branchCycles = async (branchId: string): Promise<string[]> =>
    (await prisma.settings.findUnique({ where: { branchId }, select: { schoolCycles: true } }))?.schoolCycles ?? [];

const amount = (value: unknown): number => {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : typeof value === 'number' ? value : value == null ? 0 : NaN;
    if (!Number.isFinite(n) || n < 0) throw new Error('Each amount must be a positive number');
    return Math.round(n * 100) / 100;
};

/** One row per level of the branch's cycles; levels without fees show 0. */
export const getTuitionGrid = async (branchId: string): Promise<TuitionRow[]> => {
    const levels = levelsOfCycles(await branchCycles(branchId));
    const saved = await prisma.tuitionFee.findMany({ where: { branchId } });
    return levels.map((level) => {
        const row = saved.find((s) => s.level === level);
        return { level, inscriptionFee: row?.inscriptionFee ?? 0, monthlyFee: row?.monthlyFee ?? 0, insuranceFee: row?.insuranceFee ?? 0 };
    });
};

export const saveTuitionGrid = async (branchId: string, items: unknown): Promise<TuitionRow[]> => {
    if (!Array.isArray(items)) throw new Error('items must be a list');
    const levels = levelsOfCycles(await branchCycles(branchId));
    const rows = items.map((item: any) => {
        if (!levels.includes(item?.level)) throw new Error(`Level ${item?.level} is not one of this school's cycles`);
        return { level: item.level as string, inscriptionFee: amount(item.inscriptionFee), monthlyFee: amount(item.monthlyFee), insuranceFee: amount(item.insuranceFee) };
    });
    for (const { level, ...fees } of rows) {
        await prisma.tuitionFee.upsert({
            where: { branchId_level: { branchId, level } },
            create: { branchId, level, ...fees },
            update: fees,
        });
    }
    return getTuitionGrid(branchId);
};

export const feesForLevel = async (branchId: string, level: string) =>
    prisma.tuitionFee.findUnique({ where: { branchId_level: { branchId, level } } });
