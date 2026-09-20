import prisma from '../../config/database';
import { currentMonth, isValidMonth, startOfNextMonth } from './month';

export interface TransportPaymentData {
    subscriptionId: string;
    branchId: string;
    forMonth: string;
    amount?: number;
    method: string;
    note?: string;
    date?: Date;
}

export const recordTransportPayment = async (data: TransportPaymentData) => {
    const { subscriptionId, branchId } = data;

    const subscription = await prisma.transportSubscription.findFirst({
        where: { id: subscriptionId, branchId },
        include: { student: true },
    });
    if (!subscription) throw new Error('Subscription not found');
    if (subscription.status === 'ENDED') throw new Error('Subscription has ended');

    if (!isValidMonth(data.forMonth)) throw new Error('forMonth must be in YYYY-MM format');
    if (typeof data.method !== 'string' || !data.method.trim()) throw new Error('Method is required');

    const amount = data.amount ?? subscription.monthlyPrice;
    if (!(amount > 0)) throw new Error('Amount must be greater than 0');

    const date = data.date ?? new Date();

    // Payment and Transaction are written together; the duplicate-month check lives inside the same
    // transaction (there is no unique index — MongoDB treats missing/null as equal).
    return prisma.$transaction(async (tx) => {
        const duplicate = await tx.payment.findFirst({
            where: { transportSubscriptionId: subscriptionId, forMonth: data.forMonth, branchId },
        });
        if (duplicate) throw new Error('Payment already recorded for this month');

        const payment = await tx.payment.create({
            data: {
                studentId: subscription.studentId,
                transportSubscriptionId: subscriptionId,
                forMonth: data.forMonth,
                amount,
                method: data.method.trim(),
                note: data.note,
                date,
                branchId,
            },
        });

        await tx.transaction.create({
            data: {
                type: 'INCOME',
                amount,
                category: 'Transport',
                branchId,
                description: `Transport ${data.forMonth} — ${subscription.student.name} ${subscription.student.surname} (${data.method.trim()})`,
                date,
            },
        });

        return payment;
    });
};

// ACTIVE subscriptions that had started by the end of `month` and have no payment recorded for it.
export const getDues = async (branchId: string, month: string = currentMonth()) => {
    if (!isValidMonth(month)) throw new Error('month must be in YYYY-MM format');

    const subscriptions = await prisma.transportSubscription.findMany({
        where: { branchId, status: 'ACTIVE', startDate: { lt: startOfNextMonth(month) } },
        include: { student: true, route: true, stop: true },
        orderBy: { createdAt: 'asc' },
    });
    if (subscriptions.length === 0) return [];

    const paid = await prisma.payment.findMany({
        where: {
            branchId,
            forMonth: month,
            transportSubscriptionId: { in: subscriptions.map((subscription) => subscription.id) },
        },
        select: { transportSubscriptionId: true },
    });
    const paidIds = new Set(paid.map((payment) => payment.transportSubscriptionId));

    return subscriptions.filter((subscription) => !paidIds.has(subscription.id));
};
