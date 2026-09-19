import prisma from '../../config/database';
import { currentMonth } from './month';
import { OPEN_STATUSES } from './openSubscriptions';
import { resolveMonthlyPrice } from './pricing';

export interface CreateSubscriptionData {
    studentId: string;
    routeId: string;
    stopId: string;
    startDate?: Date;
    branchId: string;
}

type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';

const assertRoomOnRoute = async (route: { id: string; vehicle: { capacity: number } }, branchId: string) => {
    const activeCount = await prisma.transportSubscription.count({
        where: { routeId: route.id, branchId, status: 'ACTIVE' },
    });
    if (activeCount >= route.vehicle.capacity) throw new Error('Vehicle is at full capacity');
};

const findOwned = async (id: string, branchId: string) => {
    const subscription = await prisma.transportSubscription.findFirst({ where: { id, branchId } });
    if (!subscription) throw new Error('Subscription not found');
    return subscription;
};

export const createSubscription = async (data: CreateSubscriptionData) => {
    const { studentId, routeId, stopId, branchId } = data;

    const student = await prisma.student.findFirst({ where: { id: studentId, branchId } });
    if (!student) throw new Error('Student not found');

    const route = await prisma.transportRoute.findFirst({
        where: { id: routeId, branchId, active: true },
        include: { vehicle: true },
    });
    if (!route) throw new Error('Route not found');

    const stop = await prisma.transportStop.findFirst({ where: { id: stopId, routeId, branchId, active: true } });
    if (!stop) throw new Error('Stop does not belong to this route');

    const open = await prisma.transportSubscription.findFirst({
        where: { studentId, branchId, status: { in: [...OPEN_STATUSES] } },
    });
    if (open) throw new Error('Student already has an open transport subscription');

    await assertRoomOnRoute(route, branchId);

    const settings = await prisma.settings.findUnique({ where: { branchId } });
    const monthlyPrice = resolveMonthlyPrice(
        settings?.transportPricingMode,
        route,
        stop,
        settings?.transportUniformPrice
    );

    return prisma.transportSubscription.create({
        data: { studentId, routeId, stopId, monthlyPrice, startDate: data.startDate ?? new Date(), branchId },
        include: { student: true, route: true, stop: true },
    });
};

export const pauseSubscription = async (id: string, branchId: string) => {
    const subscription = await findOwned(id, branchId);
    if (subscription.status !== 'ACTIVE') throw new Error('Only an active subscription can be paused');

    return prisma.transportSubscription.update({ where: { id }, data: { status: 'PAUSED' } });
};

export const resumeSubscription = async (id: string, branchId: string) => {
    const subscription = await findOwned(id, branchId);
    if (subscription.status !== 'PAUSED') throw new Error('Only a paused subscription can be resumed');

    const route = await prisma.transportRoute.findFirst({
        where: { id: subscription.routeId, branchId },
        include: { vehicle: true },
    });
    if (!route) throw new Error('Route not found');

    await assertRoomOnRoute(route, branchId);

    return prisma.transportSubscription.update({ where: { id }, data: { status: 'ACTIVE' } });
};

export const endSubscription = async (id: string, branchId: string) => {
    const subscription = await findOwned(id, branchId);
    if (subscription.status === 'ENDED') throw new Error('Subscription has already ended');

    return prisma.transportSubscription.update({ where: { id }, data: { status: 'ENDED', endDate: new Date() } });
};

export const listSubscriptions = async (branchId: string, status?: SubscriptionStatus) => {
    return prisma.transportSubscription.findMany({
        where: { branchId, ...(status && { status }) },
        include: { student: true, route: true, stop: true },
        orderBy: { createdAt: 'desc' },
    });
};

// The student's current (ACTIVE/PAUSED) subscription with route/driver/vehicle/stop, plus whether
// the current month is paid. Powers the card on the student page.
export const getOpenSubscriptionForStudent = async (studentId: string, branchId: string) => {
    const subscription = await prisma.transportSubscription.findFirst({
        where: { studentId, branchId, status: { in: [...OPEN_STATUSES] } },
        include: { route: { include: { driver: true, vehicle: true } }, stop: true },
    });
    if (!subscription) return null;

    const month = currentMonth();
    const payment = await prisma.payment.findFirst({
        where: { transportSubscriptionId: subscription.id, forMonth: month, branchId },
    });

    return { ...subscription, currentMonth: month, paidCurrentMonth: !!payment };
};
