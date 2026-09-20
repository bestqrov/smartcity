import prisma from '../../config/database';
import { getAllVehicles, createVehicle, updateVehicle, deleteVehicle } from './vehicles.service';
import * as open from './openSubscriptions';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        vehicle: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    },
}));
jest.mock('./openSubscriptions');

describe('vehicles service — branch scoping', () => {
    afterEach(() => jest.clearAllMocks());

    it('getAllVehicles only returns active vehicles of the given branch', async () => {
        (prisma.vehicle.findMany as jest.Mock).mockResolvedValue([]);

        await getAllVehicles('b1');

        expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1', active: true } })
        );
    });

    it('createVehicle stamps the given branchId and trims the plate', async () => {
        (prisma.vehicle.create as jest.Mock).mockResolvedValue({ id: 'v1' });

        await createVehicle({ plate: ' 12345-A-6 ', capacity: 30, branchId: 'b1' });

        expect(prisma.vehicle.create).toHaveBeenCalledWith({
            data: { plate: '12345-A-6', capacity: 30, branchId: 'b1' },
        });
    });

    it('createVehicle rejects a non-positive or non-integer capacity', async () => {
        await expect(createVehicle({ plate: 'A', capacity: 0, branchId: 'b1' })).rejects.toThrow(
            'Capacity must be a positive integer'
        );
        await expect(createVehicle({ plate: 'A', capacity: 2.5, branchId: 'b1' })).rejects.toThrow(
            'Capacity must be a positive integer'
        );
    });

    it('createVehicle rejects a blank plate', async () => {
        await expect(createVehicle({ plate: '  ', capacity: 10, branchId: 'b1' })).rejects.toThrow('Plate is required');
    });

    it('updateVehicle throws for a vehicle outside the branch', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(updateVehicle('v1', 'b1', { plate: 'X' })).rejects.toThrow('Vehicle not found');
        expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({ where: { id: 'v1', branchId: 'b1' } });
    });

    it('updateVehicle refuses to deactivate a vehicle whose routes have open subscriptions', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
        (open.countOpenSubscriptionsForRoutesOf as jest.Mock).mockResolvedValue(3);

        await expect(updateVehicle('v1', 'b1', { active: false })).rejects.toThrow(
            'Vehicle is used by routes with active subscriptions'
        );
        expect(prisma.vehicle.update).not.toHaveBeenCalled();
    });

    it('deleteVehicle soft-deletes an unused vehicle', async () => {
        (prisma.vehicle.findFirst as jest.Mock).mockResolvedValue({ id: 'v1' });
        (open.countOpenSubscriptionsForRoutesOf as jest.Mock).mockResolvedValue(0);
        (prisma.vehicle.update as jest.Mock).mockResolvedValue({ id: 'v1', active: false });

        await deleteVehicle('v1', 'b1');

        expect(prisma.vehicle.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { active: false } });
    });
});
