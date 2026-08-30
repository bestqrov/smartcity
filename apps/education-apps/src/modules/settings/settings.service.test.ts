import prisma from '../../config/database';
import { getSettings, updateSettings } from './settings.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        settings: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getSettings returns the existing row for the given branch', async () => {
        (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });

        const result = await getSettings('b1');

        expect(prisma.settings.findFirst).toHaveBeenCalledWith({ where: { branchId: 'b1' } });
        expect(prisma.settings.create).not.toHaveBeenCalled();
        expect(result).toEqual({ id: 'set1', branchId: 'b1' });
    });

    it('getSettings creates a default row scoped to the branch when none exists', async () => {
        (prisma.settings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.settings.create as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });

        await getSettings('b1');

        expect(prisma.settings.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1' }) })
        );
    });

    it('updateSettings updates the row scoped to the branch when one exists', async () => {
        (prisma.settings.findFirst as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });
        (prisma.settings.update as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1', schoolName: 'New Name' });

        await updateSettings('b1', { schoolName: 'New Name' });

        expect(prisma.settings.update).toHaveBeenCalledWith({
            where: { id: 'set1' },
            data: { schoolName: 'New Name' },
        });
    });

    it('updateSettings creates a branch-scoped row when none exists yet', async () => {
        (prisma.settings.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.settings.create as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });

        await updateSettings('b1', { schoolName: 'New Name' });

        expect(prisma.settings.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ branchId: 'b1', schoolName: 'New Name' }) })
        );
    });
});
