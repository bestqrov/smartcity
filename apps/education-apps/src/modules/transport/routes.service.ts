import prisma from '../../config/database';
import { assertId } from './ids';
import { countOpenSubscriptions } from './openSubscriptions';

export interface RouteData {
    name: string;
    vehicleId: string;
    driverId: string;
    monthlyPrice?: number | null;
    branchId: string;
}

export interface UpdateRouteData {
    name?: string;
    vehicleId?: string;
    driverId?: string;
    monthlyPrice?: number | null;
    active?: boolean;
}

export interface StopData {
    name: string;
    order: number;
    morningTime: string;
    afternoonTime: string;
    monthlyPrice?: number | null;
}

export interface UpdateStopData extends Partial<StopData> {}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const assertName = (name: unknown) => {
    if (typeof name !== 'string' || !name.trim()) throw new Error('Name is required');
};

const assertPrice = (price: unknown) => {
    if (price !== undefined && price !== null && !(typeof price === 'number' && price >= 0)) {
        throw new Error('Price must be a non-negative number');
    }
};

const assertTime = (label: string, value: unknown) => {
    if (typeof value !== 'string' || !TIME_RE.test(value)) throw new Error(`${label} must be in HH:mm format`);
};

const assertOrder = (order: unknown) => {
    if (!Number.isInteger(order) || (order as number) < 1) throw new Error('Order must be a positive integer');
};

const findVehicle = async (vehicleId: string, branchId: string) => {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, branchId, active: true } });
    if (!vehicle) throw new Error('Vehicle does not belong to this branch');
    return vehicle;
};

const assertDriver = async (driverId: string, branchId: string) => {
    const driver = await prisma.driver.findFirst({ where: { id: driverId, branchId, active: true } });
    if (!driver) throw new Error('Driver does not belong to this branch');
};

// ---------- routes ----------

export const getAllRoutes = async (branchId: string) => {
    return prisma.transportRoute.findMany({
        where: { branchId, active: true },
        include: {
            vehicle: true,
            driver: true,
            stops: { where: { active: true }, orderBy: { order: 'asc' } },
        },
        orderBy: { name: 'asc' },
    });
};

export const createRoute = async (data: RouteData) => {
    assertId('Vehicle id', data.vehicleId);
    assertId('Driver id', data.driverId);
    assertName(data.name);
    assertPrice(data.monthlyPrice);
    await findVehicle(data.vehicleId, data.branchId);
    await assertDriver(data.driverId, data.branchId);

    return prisma.transportRoute.create({
        data: {
            name: data.name.trim(),
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            monthlyPrice: data.monthlyPrice,
            branchId: data.branchId,
        },
    });
};

export const updateRoute = async (id: string, branchId: string, data: UpdateRouteData) => {
    if (data.vehicleId !== undefined) assertId('Vehicle id', data.vehicleId);
    if (data.driverId !== undefined) assertId('Driver id', data.driverId);
    const existing = await prisma.transportRoute.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Route not found');

    if (data.name !== undefined) assertName(data.name);
    if (data.monthlyPrice !== undefined) assertPrice(data.monthlyPrice);

    if (data.vehicleId !== undefined && data.vehicleId !== existing.vehicleId) {
        const vehicle = await findVehicle(data.vehicleId, branchId);
        const activeCount = await prisma.transportSubscription.count({
            where: { routeId: id, branchId, status: 'ACTIVE' },
        });
        if (activeCount > vehicle.capacity) {
            throw new Error("New vehicle capacity is lower than the route's active subscriptions");
        }
    }
    if (data.driverId !== undefined && data.driverId !== existing.driverId) {
        await assertDriver(data.driverId, branchId);
    }
    if (data.active === false && (await countOpenSubscriptions(branchId, { routeId: id })) > 0) {
        throw new Error('Route has active subscriptions');
    }

    return prisma.transportRoute.update({
        where: { id },
        data: {
            name: data.name?.trim(),
            vehicleId: data.vehicleId,
            driverId: data.driverId,
            monthlyPrice: data.monthlyPrice,
            active: data.active,
        },
    });
};

export const deleteRoute = async (id: string, branchId: string) => {
    const existing = await prisma.transportRoute.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Route not found');

    if ((await countOpenSubscriptions(branchId, { routeId: id })) > 0) {
        throw new Error('Route has active subscriptions');
    }

    return prisma.transportRoute.update({ where: { id }, data: { active: false } });
};

// ---------- stops ----------

export const createStop = async (routeId: string, branchId: string, data: StopData) => {
    const route = await prisma.transportRoute.findFirst({ where: { id: routeId, branchId, active: true } });
    if (!route) throw new Error('Route not found');

    assertName(data.name);
    assertOrder(data.order);
    assertTime('Morning time', data.morningTime);
    assertTime('Afternoon time', data.afternoonTime);
    assertPrice(data.monthlyPrice);

    return prisma.transportStop.create({
        data: {
            name: data.name.trim(),
            order: data.order,
            morningTime: data.morningTime,
            afternoonTime: data.afternoonTime,
            monthlyPrice: data.monthlyPrice,
            routeId,
            branchId,
        },
    });
};

export const updateStop = async (routeId: string, id: string, branchId: string, data: UpdateStopData) => {
    const existing = await prisma.transportStop.findFirst({ where: { id, routeId, branchId } });
    if (!existing) throw new Error('Stop not found');

    if (data.name !== undefined) assertName(data.name);
    if (data.order !== undefined) assertOrder(data.order);
    if (data.morningTime !== undefined) assertTime('Morning time', data.morningTime);
    if (data.afternoonTime !== undefined) assertTime('Afternoon time', data.afternoonTime);
    if (data.monthlyPrice !== undefined) assertPrice(data.monthlyPrice);

    return prisma.transportStop.update({
        where: { id },
        data: {
            name: data.name?.trim(),
            order: data.order,
            morningTime: data.morningTime,
            afternoonTime: data.afternoonTime,
            monthlyPrice: data.monthlyPrice,
        },
    });
};

export const deleteStop = async (routeId: string, id: string, branchId: string) => {
    const existing = await prisma.transportStop.findFirst({ where: { id, routeId, branchId } });
    if (!existing) throw new Error('Stop not found');

    if ((await countOpenSubscriptions(branchId, { stopId: id })) > 0) {
        throw new Error('Stop has active subscriptions');
    }

    return prisma.transportStop.update({ where: { id }, data: { active: false } });
};
