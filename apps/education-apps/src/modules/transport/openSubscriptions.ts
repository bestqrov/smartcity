import prisma from '../../config/database';

export const OPEN_STATUSES = ['ACTIVE', 'PAUSED'] as const;

interface OpenFilter {
    routeId?: string;
    routeIds?: string[];
    stopId?: string;
}

export const countOpenSubscriptions = (branchId: string, filter: OpenFilter) =>
    prisma.transportSubscription.count({
        where: {
            branchId,
            status: { in: [...OPEN_STATUSES] },
            ...(filter.routeId && { routeId: filter.routeId }),
            ...(filter.routeIds && { routeId: { in: filter.routeIds } }),
            ...(filter.stopId && { stopId: filter.stopId }),
        },
    });

// Vehicles and drivers are only referenced through routes, so "in use" means
// "one of their routes has an ACTIVE/PAUSED subscription".
export const countOpenSubscriptionsForRoutesOf = async (
    branchId: string,
    field: 'vehicleId' | 'driverId',
    id: string
): Promise<number> => {
    const routes = await prisma.transportRoute.findMany({
        where: { branchId, [field]: id },
        select: { id: true },
    });

    if (routes.length === 0) return 0;

    return countOpenSubscriptions(branchId, { routeIds: routes.map((route) => route.id) });
};
