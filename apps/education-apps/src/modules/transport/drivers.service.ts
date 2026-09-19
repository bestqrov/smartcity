import prisma from '../../config/database';
import { countOpenSubscriptionsForRoutesOf } from './openSubscriptions';

export interface DriverData {
    name: string;
    phone: string;
    branchId: string;
}

export interface UpdateDriverData {
    name?: string;
    phone?: string;
    active?: boolean;
}

const assertName = (name: unknown) => {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name is required');
};

const assertPhone = (phone: unknown) => {
    if (typeof phone !== 'string' || !phone.trim()) throw new Error('Phone is required');
};

const assertNotInUse = async (id: string, branchId: string) => {
    if ((await countOpenSubscriptionsForRoutesOf(branchId, 'driverId', id)) > 0) {
        throw new Error('Driver is used by routes with active subscriptions');
    }
};

export const getAllDrivers = async (branchId: string) => {
    return prisma.driver.findMany({ where: { branchId, active: true }, orderBy: { name: 'asc' } });
};

export const createDriver = async (data: DriverData) => {
    assertName(data.name);
    assertPhone(data.phone);

    return prisma.driver.create({
        data: { name: data.name.trim(), phone: data.phone.trim(), branchId: data.branchId },
    });
};

export const updateDriver = async (id: string, branchId: string, data: UpdateDriverData) => {
    const existing = await prisma.driver.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Driver not found');

    if (data.name !== undefined) assertName(data.name);
    if (data.phone !== undefined) assertPhone(data.phone);
    if (data.active === false) await assertNotInUse(id, branchId);

    return prisma.driver.update({
        where: { id },
        data: { name: data.name?.trim(), phone: data.phone?.trim(), active: data.active },
    });
};

export const deleteDriver = async (id: string, branchId: string) => {
    const existing = await prisma.driver.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Driver not found');

    await assertNotInUse(id, branchId);

    return prisma.driver.update({ where: { id }, data: { active: false } });
};
