import prisma from '../../config/database';
import { countOpenSubscriptionsForRoutesOf } from './openSubscriptions';

export interface VehicleData {
    plate: string;
    capacity: number;
    branchId: string;
}

export interface UpdateVehicleData {
    plate?: string;
    capacity?: number;
    active?: boolean;
}

const assertPlate = (plate: unknown) => {
    if (typeof plate !== 'string' || !plate.trim()) throw new Error('Plate is required');
};

const assertCapacity = (capacity: unknown) => {
    if (!Number.isInteger(capacity) || (capacity as number) < 1) {
        throw new Error('Capacity must be a positive integer');
    }
};

const assertNotInUse = async (id: string, branchId: string) => {
    if ((await countOpenSubscriptionsForRoutesOf(branchId, 'vehicleId', id)) > 0) {
        throw new Error('Vehicle is used by routes with active subscriptions');
    }
};

export const getAllVehicles = async (branchId: string) => {
    return prisma.vehicle.findMany({ where: { branchId, active: true }, orderBy: { plate: 'asc' } });
};

export const createVehicle = async (data: VehicleData) => {
    assertPlate(data.plate);
    assertCapacity(data.capacity);

    return prisma.vehicle.create({
        data: { plate: data.plate.trim(), capacity: data.capacity, branchId: data.branchId },
    });
};

export const updateVehicle = async (id: string, branchId: string, data: UpdateVehicleData) => {
    const existing = await prisma.vehicle.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Vehicle not found');

    if (data.plate !== undefined) assertPlate(data.plate);
    if (data.capacity !== undefined) assertCapacity(data.capacity);
    if (data.active === false) await assertNotInUse(id, branchId);

    return prisma.vehicle.update({
        where: { id },
        data: { plate: data.plate?.trim(), capacity: data.capacity, active: data.active },
    });
};

export const deleteVehicle = async (id: string, branchId: string) => {
    const existing = await prisma.vehicle.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Vehicle not found');

    await assertNotInUse(id, branchId);

    return prisma.vehicle.update({ where: { id }, data: { active: false } });
};
