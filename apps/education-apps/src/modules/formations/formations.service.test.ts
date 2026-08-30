import prisma from '../../config/database';
import { createFormation, getFormations, updateFormation, deleteFormation } from './formations.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        formation: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createFormation stamps branchId from the given value', async () => {
        (prisma.formation.create as jest.Mock).mockResolvedValue({ id: 'f1', branchId: 'b1' });

        await createFormation({ name: 'Anglais Intensif', duration: '3 mois', price: 1000, branchId: 'b1' } as any);

        expect(prisma.formation.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getFormations only returns formations in the given branch', async () => {
        (prisma.formation.findMany as jest.Mock).mockResolvedValue([]);

        await getFormations('b1');

        expect(prisma.formation.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('updateFormation throws for a formation outside the given branch', async () => {
        (prisma.formation.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
            updateFormation('f1', 'b1', { name: 'New Name', duration: '1 mois', price: 500 } as any)
        ).rejects.toThrow('Formation not found');
    });

    it('updateFormation builds an explicit update payload', async () => {
        (prisma.formation.findFirst as jest.Mock).mockResolvedValue({ id: 'f1', branchId: 'b1' });
        (prisma.formation.update as jest.Mock).mockResolvedValue({ id: 'f1', branchId: 'b1', name: 'New Name' });

        await updateFormation('f1', 'b1', { name: 'New Name', duration: '1 mois', price: 500 });

        expect(prisma.formation.update).toHaveBeenCalledWith({
            where: { id: 'f1' },
            data: { name: 'New Name', duration: '1 mois', price: 500, description: undefined },
        });
    });

    it('deleteFormation throws for a formation outside the given branch', async () => {
        (prisma.formation.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(deleteFormation('f1', 'b1')).rejects.toThrow('Formation not found');
    });
});
