import prisma from '../../config/database';
import { countOpenSubscriptions, countOpenSubscriptionsForRoutesOf } from './openSubscriptions';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        transportSubscription: { count: jest.fn() },
        transportRoute: { findMany: jest.fn() },
    },
}));

describe('open subscription counters', () => {
    afterEach(() => jest.clearAllMocks());

    it('countOpenSubscriptions counts ACTIVE and PAUSED in the branch, filtered by stop', async () => {
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(2);

        const result = await countOpenSubscriptions('b1', { stopId: 'st1' });

        expect(result).toBe(2);
        expect(prisma.transportSubscription.count).toHaveBeenCalledWith({
            where: { branchId: 'b1', status: { in: ['ACTIVE', 'PAUSED'] }, stopId: 'st1' },
        });
    });

    it('countOpenSubscriptionsForRoutesOf looks up the routes of a vehicle in the branch first', async () => {
        (prisma.transportRoute.findMany as jest.Mock).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(1);

        const result = await countOpenSubscriptionsForRoutesOf('b1', 'vehicleId', 'v1');

        expect(prisma.transportRoute.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1', vehicleId: 'v1' },
            select: { id: true },
        });
        expect(prisma.transportSubscription.count).toHaveBeenCalledWith({
            where: { branchId: 'b1', status: { in: ['ACTIVE', 'PAUSED'] }, routeId: { in: ['r1', 'r2'] } },
        });
        expect(result).toBe(1);
    });

    it('countOpenSubscriptionsForRoutesOf returns 0 without counting when there are no routes', async () => {
        (prisma.transportRoute.findMany as jest.Mock).mockResolvedValue([]);

        const result = await countOpenSubscriptionsForRoutesOf('b1', 'driverId', 'd1');

        expect(result).toBe(0);
        expect(prisma.transportSubscription.count).not.toHaveBeenCalled();
    });
});
