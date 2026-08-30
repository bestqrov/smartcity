import prisma from '../../config/database';
import { getAllPricing, getPricingByCategory, createPricing, updatePricing, deletePricing } from './pricing.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        pricing: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getAllPricing filters by branchId', async () => {
        (prisma.pricing.findMany as jest.Mock).mockResolvedValue([]);

        await getAllPricing('b1');

        expect(prisma.pricing.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ branchId: 'b1', active: true }) })
        );
    });

    it('getPricingByCategory filters by branchId', async () => {
        (prisma.pricing.findMany as jest.Mock).mockResolvedValue([]);

        await getPricingByCategory('SOUTIEN', 'b1');

        expect(prisma.pricing.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ category: 'SOUTIEN', branchId: 'b1', active: true }) })
        );
    });

    it('createPricing stamps branchId from the given value', async () => {
        (prisma.pricing.create as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });

        await createPricing({ category: 'SOUTIEN', level: 'LYCEE', subject: 'MATHS', price: 100, branchId: 'b1' } as any);

        expect(prisma.pricing.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('updatePricing throws for a pricing row outside the given branch', async () => {
        (prisma.pricing.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updatePricing('p1', 'b1', { price: 200 })).rejects.toThrow('Pricing not found');
    });

    it('updatePricing drops a smuggled branchId and only updates named fields', async () => {
        (prisma.pricing.findFirst as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1' });
        (prisma.pricing.update as jest.Mock).mockResolvedValue({ id: 'p1', branchId: 'b1', price: 200 });

        await updatePricing('p1', 'b1', { price: 200, branchId: 'other-branch' } as any);

        expect(prisma.pricing.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.not.objectContaining({ branchId: expect.anything() }) })
        );
    });

    it('deletePricing (soft-delete) throws for a pricing row outside the given branch', async () => {
        (prisma.pricing.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(deletePricing('p1', 'b1')).rejects.toThrow('Pricing not found');
    });
});
