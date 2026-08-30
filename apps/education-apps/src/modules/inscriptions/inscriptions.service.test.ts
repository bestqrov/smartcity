import prisma from '../../config/database';
import { createInscription, getAllInscriptions, getInscriptionById, updateInscription } from './inscriptions.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findUnique: jest.fn() },
        inscription: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    },
}));

jest.mock('../payments/payments.service', () => ({
    createPayment: jest.fn().mockResolvedValue({}),
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('createInscription throws when the student belongs to a different branch', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'other-branch' });

        await expect(
            createInscription({ studentId: 's1', type: 'SOUTIEN', category: 'math', amount: 100, branchId: 'b1' } as any)
        ).rejects.toThrow('Student not found');
    });

    it('createInscription stamps branchId from the given value when the student matches', async () => {
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.inscription.create as jest.Mock).mockResolvedValue({ id: 'i1', branchId: 'b1' });

        await createInscription({ studentId: 's1', type: 'SOUTIEN', category: 'math', amount: 100, branchId: 'b1' } as any);

        expect(prisma.inscription.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('getAllInscriptions only returns inscriptions in the given branch', async () => {
        (prisma.inscription.findMany as jest.Mock).mockResolvedValue([]);

        await getAllInscriptions('b1');

        expect(prisma.inscription.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
    });

    it('getInscriptionById throws for an inscription outside the given branch (using findFirst)', async () => {
        (prisma.inscription.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(getInscriptionById('i1', 'b1')).rejects.toThrow('Inscription not found');
        expect(prisma.inscription.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'i1', branchId: 'b1' } }));
    });

    it('updateInscription drops a smuggled branchId and only updates named fields', async () => {
        (prisma.inscription.findFirst as jest.Mock).mockResolvedValue({ id: 'i1', branchId: 'b1', type: 'SOUTIEN', category: 'math' });
        (prisma.inscription.update as jest.Mock).mockResolvedValue({ id: 'i1', branchId: 'b1', amount: 200 });

        await updateInscription('i1', 'b1', { amount: 200, branchId: 'other-branch' } as any);

        expect(prisma.inscription.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.not.objectContaining({ branchId: expect.anything() }) })
        );
    });

    it('passes branchId through to the auto-created payment', async () => {
        const { createPayment } = require('../payments/payments.service');
        (prisma.student.findUnique as jest.Mock).mockResolvedValue({ id: 's1', branchId: 'b1' });
        (prisma.inscription.create as jest.Mock).mockResolvedValue({ id: 'i1', branchId: 'b1' });

        await createInscription({ studentId: 's1', type: 'SOUTIEN', category: 'math', amount: 100, branchId: 'b1' } as any);

        expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'b1' }));
    });
});
