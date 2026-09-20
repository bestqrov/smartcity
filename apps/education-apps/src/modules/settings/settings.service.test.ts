import prisma from '../../config/database';
import { getSettings, updateSettings } from './settings.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        settings: { upsert: jest.fn() },
    },
}));

describe('branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getSettings upserts scoped to the branch', async () => {
        (prisma.settings.upsert as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1' });

        const result = await getSettings('b1');

        expect(prisma.settings.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1' } })
        );
        expect(result).toEqual({ id: 'set1', branchId: 'b1' });
    });

    it('updateSettings upserts with the given data scoped to the branch', async () => {
        (prisma.settings.upsert as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1', schoolName: 'New Name' });

        await updateSettings('b1', { schoolName: 'New Name' });

        expect(prisma.settings.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { branchId: 'b1' },
                update: { schoolName: 'New Name' },
            })
        );
    });

    it('updateSettings\'s create branch covers defaults merged with the given data', async () => {
        (prisma.settings.upsert as jest.Mock).mockResolvedValue({ id: 'set1', branchId: 'b1', schoolName: 'New Name' });

        await updateSettings('b1', { schoolName: 'New Name' });

        expect(prisma.settings.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ branchId: 'b1', schoolName: 'New Name' }),
            })
        );
    });
});

describe('transport pricing settings', () => {
    afterEach(() => jest.clearAllMocks());

    it('updateSettings passes the transport fields through to update and create', async () => {
        (prisma.settings.upsert as jest.Mock).mockResolvedValue({ id: 'set1' });

        await updateSettings('b1', { transportPricingMode: 'UNIFORM', transportUniformPrice: 200 });

        expect(prisma.settings.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: { transportPricingMode: 'UNIFORM', transportUniformPrice: 200 },
                create: expect.objectContaining({
                    branchId: 'b1',
                    transportPricingMode: 'UNIFORM',
                    transportUniformPrice: 200,
                }),
            })
        );
    });

    it('updateSettings leaves transport fields out of create when not provided', async () => {
        (prisma.settings.upsert as jest.Mock).mockResolvedValue({ id: 'set1' });

        await updateSettings('b1', { schoolName: 'X' });

        const call = (prisma.settings.upsert as jest.Mock).mock.calls[0][0];
        expect(call.create).not.toHaveProperty('transportPricingMode');
        expect(call.create).not.toHaveProperty('transportUniformPrice');
    });
});
