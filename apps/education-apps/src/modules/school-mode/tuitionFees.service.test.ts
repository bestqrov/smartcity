import prisma from '../../config/database';
import { getTuitionGrid, saveTuitionGrid } from './tuitionFees.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        settings: { findUnique: jest.fn() },
        tuitionFee: { findMany: jest.fn(), upsert: jest.fn(), findUnique: jest.fn() },
        $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    },
}));
const db = prisma as any;

beforeEach(() => {
    jest.clearAllMocks();
    db.settings.findUnique.mockResolvedValue({ schoolCycles: ['PRESCOLAIRE'] });
});

describe('getTuitionGrid', () => {
    it('returns one row per level of the cycles, zero when not set', async () => {
        db.tuitionFee.findMany.mockResolvedValue([{ level: 'PS2', inscriptionFee: 500, monthlyFee: 600, insuranceFee: 150 }]);
        expect(await getTuitionGrid('b1')).toEqual([
            { level: 'PS1', inscriptionFee: 0, monthlyFee: 0, insuranceFee: 0 },
            { level: 'PS2', inscriptionFee: 500, monthlyFee: 600, insuranceFee: 150 },
            { level: 'PS3', inscriptionFee: 0, monthlyFee: 0, insuranceFee: 0 },
        ]);
    });
});

describe('saveTuitionGrid', () => {
    it('upserts each row of the branch', async () => {
        db.tuitionFee.findMany.mockResolvedValue([]);
        await saveTuitionGrid('b1', [{ level: 'PS1', inscriptionFee: 400, monthlyFee: '550', insuranceFee: 0 }]);
        expect(db.tuitionFee.upsert).toHaveBeenCalledWith({
            where: { branchId_level: { branchId: 'b1', level: 'PS1' } },
            create: { branchId: 'b1', level: 'PS1', inscriptionFee: 400, monthlyFee: 550, insuranceFee: 0 },
            update: { inscriptionFee: 400, monthlyFee: 550, insuranceFee: 0 },
        });
    });

    it('refuses levels outside the cycles and negative amounts', async () => {
        await expect(saveTuitionGrid('b1', [{ level: 'P1', inscriptionFee: 1, monthlyFee: 1, insuranceFee: 1 }])).rejects.toThrow('cycles de l’établissement');
        await expect(saveTuitionGrid('b1', [{ level: 'PS1', inscriptionFee: -1, monthlyFee: 1, insuranceFee: 1 }])).rejects.toThrow('nombre positif');
        await expect(saveTuitionGrid('b1', 'nope' as any)).rejects.toThrow('grille des tarifs');
        expect(db.tuitionFee.upsert).not.toHaveBeenCalled();
    });
});
