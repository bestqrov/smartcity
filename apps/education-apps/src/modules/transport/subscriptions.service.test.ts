import prisma from '../../config/database';
import {
    createSubscription,
    pauseSubscription,
    resumeSubscription,
    endSubscription,
    listSubscriptions,
    getOpenSubscriptionForStudent,
} from './subscriptions.service';
import { currentMonth } from './month';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        student: { findFirst: jest.fn() },
        transportRoute: { findFirst: jest.fn() },
        transportStop: { findFirst: jest.fn() },
        transportSubscription: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        settings: { findUnique: jest.fn() },
        payment: { findFirst: jest.fn() },
    },
}));

const route = { id: 'r1', monthlyPrice: 300, vehicle: { capacity: 2 } };
const stop = { id: 'st1', monthlyPrice: 250 };

const arrangeHappyPath = () => {
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 's1' });
    (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(route);
    (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue(stop);
    (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(0);
    (prisma.settings.findUnique as jest.Mock).mockResolvedValue({ transportPricingMode: 'ROUTE' });
    (prisma.transportSubscription.create as jest.Mock).mockResolvedValue({ id: 'sub1' });
};

describe('createSubscription', () => {
    afterEach(() => jest.resetAllMocks());

    const input = { studentId: 's1', routeId: 'r1', stopId: 'st1', branchId: 'b1' };

    it('validates every reference inside the branch and stamps branchId', async () => {
        arrangeHappyPath();

        await createSubscription(input);

        expect(prisma.student.findFirst).toHaveBeenCalledWith({ where: { id: 's1', branchId: 'b1' } });
        expect(prisma.transportRoute.findFirst).toHaveBeenCalledWith({
            where: { id: 'r1', branchId: 'b1', active: true },
            include: { vehicle: true },
        });
        expect(prisma.transportStop.findFirst).toHaveBeenCalledWith({
            where: { id: 'st1', routeId: 'r1', branchId: 'b1', active: true },
        });
        expect(prisma.transportSubscription.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ studentId: 's1', routeId: 'r1', stopId: 'st1', branchId: 'b1' }),
            })
        );
    });

    it('snapshots the price for the branch pricing mode', async () => {
        arrangeHappyPath();
        (prisma.settings.findUnique as jest.Mock).mockResolvedValue({
            transportPricingMode: 'STOP',
            transportUniformPrice: 200,
        });

        await createSubscription(input);

        expect(prisma.transportSubscription.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ monthlyPrice: 250 }) })
        );
    });

    it('falls back to ROUTE pricing when the branch has no settings row yet', async () => {
        arrangeHappyPath();
        (prisma.settings.findUnique as jest.Mock).mockResolvedValue(null);

        await createSubscription(input);

        expect(prisma.transportSubscription.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ monthlyPrice: 300 }) })
        );
    });

    it('rejects a student from another branch', async () => {
        arrangeHappyPath();
        (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(createSubscription(input)).rejects.toThrow('Student not found');
    });

    it('rejects a route from another branch', async () => {
        arrangeHappyPath();
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(createSubscription(input)).rejects.toThrow('Route not found');
    });

    it('rejects a stop that does not belong to the route', async () => {
        arrangeHappyPath();
        (prisma.transportStop.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(createSubscription(input)).rejects.toThrow('Stop does not belong to this route');
    });

    it('rejects a second open subscription for the same student', async () => {
        arrangeHappyPath();
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });

        await expect(createSubscription(input)).rejects.toThrow('Student already has an open transport subscription');
        expect(prisma.transportSubscription.findFirst).toHaveBeenCalledWith({
            where: { studentId: 's1', branchId: 'b1', status: { in: ['ACTIVE', 'PAUSED'] } },
        });
    });

    it('rejects when the route is at its vehicle capacity', async () => {
        arrangeHappyPath();
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(2);

        await expect(createSubscription(input)).rejects.toThrow('Vehicle is at full capacity');
        expect(prisma.transportSubscription.count).toHaveBeenCalledWith({
            where: { routeId: 'r1', branchId: 'b1', status: 'ACTIVE' },
        });
    });

    it('rejects when no price is configured for the mode', async () => {
        arrangeHappyPath();
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue({ ...route, monthlyPrice: null });

        await expect(createSubscription(input)).rejects.toThrow(
            'Transport price is not configured for pricing mode ROUTE'
        );
        expect(prisma.transportSubscription.create).not.toHaveBeenCalled();
    });
});

describe('status transitions', () => {
    afterEach(() => jest.resetAllMocks());

    it('pauseSubscription moves ACTIVE to PAUSED', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'ACTIVE' });
        (prisma.transportSubscription.update as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'PAUSED' });

        await pauseSubscription('sub1', 'b1');

        expect(prisma.transportSubscription.findFirst).toHaveBeenCalledWith({ where: { id: 'sub1', branchId: 'b1' } });
        expect(prisma.transportSubscription.update).toHaveBeenCalledWith({
            where: { id: 'sub1' },
            data: { status: 'PAUSED' },
        });
    });

    it('pauseSubscription rejects a subscription that is not ACTIVE', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'PAUSED' });

        await expect(pauseSubscription('sub1', 'b1')).rejects.toThrow('Only an active subscription can be paused');
    });

    it('resumeSubscription re-checks capacity before reactivating', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({
            id: 'sub1',
            status: 'PAUSED',
            routeId: 'r1',
        });
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(route);
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(2);

        await expect(resumeSubscription('sub1', 'b1')).rejects.toThrow('Vehicle is at full capacity');
        expect(prisma.transportSubscription.update).not.toHaveBeenCalled();
    });

    it('resumeSubscription moves PAUSED to ACTIVE when there is room', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({
            id: 'sub1',
            status: 'PAUSED',
            routeId: 'r1',
        });
        (prisma.transportRoute.findFirst as jest.Mock).mockResolvedValue(route);
        (prisma.transportSubscription.count as jest.Mock).mockResolvedValue(1);
        (prisma.transportSubscription.update as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'ACTIVE' });

        await resumeSubscription('sub1', 'b1');

        expect(prisma.transportSubscription.update).toHaveBeenCalledWith({
            where: { id: 'sub1' },
            data: { status: 'ACTIVE' },
        });
    });

    it('endSubscription sets ENDED and an endDate, for ACTIVE or PAUSED', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'PAUSED' });
        (prisma.transportSubscription.update as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'ENDED' });

        await endSubscription('sub1', 'b1');

        expect(prisma.transportSubscription.update).toHaveBeenCalledWith({
            where: { id: 'sub1' },
            data: { status: 'ENDED', endDate: expect.any(Date) },
        });
    });

    it('endSubscription rejects an already ended subscription', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1', status: 'ENDED' });

        await expect(endSubscription('sub1', 'b1')).rejects.toThrow('Subscription has already ended');
    });

    it('throws for a subscription outside the branch', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(pauseSubscription('sub1', 'b1')).rejects.toThrow('Subscription not found');
    });
});

describe('reads', () => {
    afterEach(() => jest.resetAllMocks());

    it('listSubscriptions is scoped to the branch and optionally filtered by status', async () => {
        (prisma.transportSubscription.findMany as jest.Mock).mockResolvedValue([]);

        await listSubscriptions('b1', 'ACTIVE');

        expect(prisma.transportSubscription.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { branchId: 'b1', status: 'ACTIVE' } })
        );
    });

    it('getOpenSubscriptionForStudent returns null when the student has none', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue(null);

        expect(await getOpenSubscriptionForStudent('s1', 'b1')).toBeNull();
    });

    it('getOpenSubscriptionForStudent reports whether the current month is paid', async () => {
        (prisma.transportSubscription.findFirst as jest.Mock).mockResolvedValue({ id: 'sub1' });
        (prisma.payment.findFirst as jest.Mock).mockResolvedValue({ id: 'p1' });

        const result = await getOpenSubscriptionForStudent('s1', 'b1');

        expect(prisma.payment.findFirst).toHaveBeenCalledWith({
            where: { transportSubscriptionId: 'sub1', forMonth: currentMonth(), branchId: 'b1' },
        });
        expect(result).toEqual(
            expect.objectContaining({ id: 'sub1', currentMonth: currentMonth(), paidCurrentMonth: true })
        );
    });
});
