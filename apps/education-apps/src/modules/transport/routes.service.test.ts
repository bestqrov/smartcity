import prisma from '../../config/database';
import {
    getAllRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    createStop,
    updateStop,
    deleteStop,
} from './routes.service';
import * as open from './openSubscriptions';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        vehicle: { findFirst: jest.fn() },
        driver: { findFirst: jest.fn() },
        transportRoute: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
        transportStop: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
        transportSubscription: { count: jest.fn() },
    },
}));
jest.mock('./openSubscriptions');

describe('routes service — branch scoping', () => {
    afterEach(() => jest.resetAllMocks());

    it('getAllRoutes only returns active routes of the branch, with ordered active stops', async () => {
        (prisma.transportRoute.findMany as jest.Mock).mockResolvedValue([]);

        await getAllRoutes('b1');

        expect(prisma.transportRoute.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { branchId: 'b1', active: true },
                include: {
                    vehicle: true,
                    driver: true,
                    stops: { where: { active: true }, orderBy: { order: 'asc' } },
                },
            })
        );
    });

    it('createRoute stamps branchId after validating vehicle and driver belong to the branch', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
        (prisma.driver.findFirst as jest.Mock).mockResolvedValue({ id: 'd1' });
        (prisma.transportRoute.create as jest.Mock).mockResolvedValue({ id: 'r1' });

        await createRoute({ name: 'Agdal', vehicleId: 'v1', driverId: 'd1', monthlyPrice: 300, branchId: 'b1' });

        expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: 'v1', branchId: 'b1', active: true } });
        expect(prisma.driver.findFirst).toHaveBeenCalledWith({ where: { id: 'd1', branchId: 'b1', active: true } });
        expect(prisma.transportRoute.create).toHaveBeenCalledWith({
            data: { name: 'Agdal', vehicleId: 'v1', driverId: 'd1', monthlyPrice: 300, branchId: 'b1' },
        });
    });

    it('createRoute rejects a vehicle from another branch', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
            createRoute({ name: 'Agdal', vehicleId: 'v9', driverId: 'd1', branchId: 'b1' })
        ).rejects.toThrow('Vehicle does not belong to this branch');
    });

    it('createRoute rejects a driver from another branch', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
        (prisma.driver.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
            createRoute({ name: 'Agdal', vehicleId: 'v1', driverId: 'd9', branchId: 'b1' })
        ).rejects.toThrow('Driver does not belong to this branch');
    });

    it('createRoute rejects a negative price', async () => {
        await expect(
            createRoute({ name: 'A', vehicleId: 'v1', driverId: 'd1', monthlyPrice: -5, branchId: 'b1' })
        ).rejects.toThrow('Price must be a non-negative number');
    });

    it('updateRoute throws for a route outside the branch', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateRoute('r1', 'b1', { name: 'X' })).rejects.toThrow('Route not found');
    });

    it('updateRoute refuses to deactivate a route with open subscriptions', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1', vehicleId: 'v1' });
        (open.countOpenSubscriptions as jest.Mock).mockResolvedValue(2);

        await expect(updateRoute('r1', 'b1', { active: false })).rejects.toThrow(
            'Route has active subscriptions'
        );
        expect(prisma.transportRoute.update).not.toHaveBeenCalled();
    });

    it('updateRoute refuses a replacement vehicle smaller than the route\'s ACTIVE subscriptions', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1', vehicleId: 'v1' });
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v2', capacity: 10 });
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(12);

        await expect(updateRoute('r1', 'b1', { vehicleId: 'v2' })).rejects.toThrow(
            'New vehicle capacity is lower than the route\'s active subscriptions'
        );
    });

    it('deleteRoute soft-deletes an unused route', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1' });
        (open.countOpenSubscriptions as jest.Mock).mockResolvedValue(0);
        (prisma.transportRoute.update as jest.Mock).mockResolvedValue({ id: 'r1' });

        await deleteRoute('r1', 'b1');

        expect(prisma.transportRoute.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { active: false } });
    });
});

describe('stops', () => {
    afterEach(() => jest.resetAllMocks());

    const stopInput = { name: 'Place Verte', order: 1, morningTime: '07:15', afternoonTime: '17:30' };

    it('createStop validates the route belongs to the branch and stamps branchId', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1' });
        (prisma.transportStop.create as jest.Mock).mockResolvedValue({ id: 'st1' });

        await createStop('r1', 'b1', { ...stopInput, monthlyPrice: 250 });

        expect(prisma.transportRoute.findFirst).toHaveBeenCalledWith({ where: { id: 'r1', branchId: 'b1', active: true } });
        expect(prisma.transportStop.create).toHaveBeenCalledWith({
            data: { ...stopInput, monthlyPrice: 250, routeId: 'r1', branchId: 'b1' },
        });
    });

    it('createStop throws when the route is not in the branch', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(createStop('r1', 'b1', stopInput)).rejects.toThrow('Route not found');
    });

    it('createStop rejects times that are not HH:mm', async () => {
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ id: 'r1' });

        await expect(createStop('r1', 'b1', { ...stopInput, morningTime: '7h15' })).rejects.toThrow(
            'Morning time must be in HH:mm format'
        );
        await expect(createStop('r1', 'b1', { ...stopInput, afternoonTime: '25:00' })).rejects.toThrow(
            'Afternoon time must be in HH:mm format'
        );
    });

    it('updateStop throws for a stop outside the branch', async () => {
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateStop('r1', 'st1', 'b1', { name: 'X' })).rejects.toThrow('Stop not found');
        expect(prisma.transportStop.findFirst).toHaveBeenCalledWith({ where: { id: 'st1', routeId: 'r1', branchId: 'b1' } });
    });

    it('updateStop/deleteStop treat a stop of another route as not found', async () => {
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateStop('other', 'st1', 'b1', { name: 'X' })).rejects.toThrow('Stop not found');
        await expect(deleteStop('other', 'st1', 'b1')).rejects.toThrow('Stop not found');
        expect(prisma.transportStop.findFirst).toHaveBeenLastCalledWith({
            where: { id: 'st1', routeId: 'other', branchId: 'b1' },
        });
    });

    it('deleteStop refuses when open subscriptions use the stop', async () => {
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue({ id: 'st1' });
        (open.countOpenSubscriptions as jest.Mock).mockResolvedValue(1);

        await expect(deleteStop('r1', 'st1', 'b1')).rejects.toThrow('Stop has active subscriptions');
        expect(open.countOpenSubscriptions).toHaveBeenCalledWith('b1', { stopId: 'st1' });
    });

    it('deleteStop soft-deletes an unused stop', async () => {
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue({ id: 'st1' });
        (open.countOpenSubscriptions as jest.Mock).mockResolvedValue(0);
        (prisma.transportStop.update as jest.Mock).mockResolvedValue({ id: 'st1' });

        await deleteStop('r1', 'st1', 'b1');

        expect(prisma.transportStop.update).toHaveBeenCalledWith({ where: { id: 'st1' }, data: { active: false } });
    });
});

describe('routes service — missing ids', () => {
    afterEach(() => jest.resetAllMocks());

    it.each([
        ['vehicleId', 'Vehicle id', () => prisma.vehicle.findFirst],
        ['driverId', 'Driver id', () => prisma.driver.findFirst],
    ])('createRoute rejects a missing %s without querying', async (field, label, mockOf) => {
        const data: any = { name: 'R', vehicleId: 'v1', driverId: 'd1', branchId: 'b1' };
        delete data[field];

        await expect(createRoute(data)).rejects.toThrow(`${label} is required`);
        expect(mockOf()).not.toHaveBeenCalled();
    });

    it.each([
        ['vehicleId', 'Vehicle id', () => prisma.vehicle.findFirst],
        ['driverId', 'Driver id', () => prisma.driver.findFirst],
    ])('updateRoute rejects a null %s without querying', async (field, label, mockOf) => {
        await expect(updateRoute('r1', 'b1', { [field]: null } as any)).rejects.toThrow(`${label} is required`);
        expect(mockOf()).not.toHaveBeenCalled();
    });
});
