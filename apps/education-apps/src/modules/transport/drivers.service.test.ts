import prisma from '../../config/database';
import { getAllDrivers, createDriver, updateDriver, deleteDriver } from './drivers.service';
import * as open from './openSubscriptions';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        driver: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    },
}));
jest.mock('./openSubscriptions');

describe('drivers service — branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getAllDrivers only returns active drivers of the given branch', async () => {
        (prisma.driver.findMany as jest.Mock).mockResolvedValue([]);

        await getAllDrivers('b1');

        expect(prisma.driver.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1', active: true } })
        );
    });

    it('createDriver stamps the given branchId', async () => {
        (prisma.driver.create as jest.Mock).mockResolvedValue({ id: 'd1' });

        await createDriver({ name: 'Ahmed', phone: '0600000000', branchId: 'b1' });

        expect(prisma.driver.create).toHaveBeenCalledWith({
            data: { name: 'Ahmed', phone: '0600000000', branchId: 'b1' },
        });
    });

    it('createDriver requires a name and a phone', async () => {
        await expect(createDriver({ name: '', phone: '06', branchId: 'b1' })).rejects.toThrow('Name is required');
        await expect(createDriver({ name: 'A', phone: ' ', branchId: 'b1' })).rejects.toThrow('Phone is required');
    });

    it('updateDriver throws for a driver outside the branch', async () => {
        (prisma.driver.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateDriver('d1', 'b1', { name: 'X' })).rejects.toThrow('Driver not found');
    });

    it('deleteDriver refuses when the driver\'s routes have open subscriptions', async () => {
        (prisma.driver.findFirst as jest.Mock).mockResolvedValue({ id: 'd1' });
        (open.countOpenSubscriptionsForRoutesOf as jest.Mock).mockResolvedValue(1);

        await expect(deleteDriver('d1', 'b1')).rejects.toThrow('Driver is used by routes with active subscriptions');
        expect(prisma.driver.update).not.toHaveBeenCalled();
    });
});
