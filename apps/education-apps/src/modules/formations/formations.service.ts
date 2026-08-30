import prisma from '../../config/database';

export interface CreateFormationData {
    name: string;
    duration: string;
    price: number;
    branchId: string;
    description?: string;
}

export interface UpdateFormationData {
    name?: string;
    duration?: string;
    price?: number;
    description?: string;
}

export const createFormation = async (data: CreateFormationData) => {
    return await prisma.formation.create({
        data: {
            name: data.name,
            duration: data.duration,
            price: data.price,
            branchId: data.branchId,
            description: data.description,
        },
    });
};

export const getFormations = async (branchId: string) => {
    return await prisma.formation.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
    });
};

export const updateFormation = async (id: string, branchId: string, data: UpdateFormationData) => {
    const existing = await prisma.formation.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Formation not found');

    const { name, duration, price, description } = data;

    return await prisma.formation.update({
        where: { id },
        data: { name, duration, price, description },
    });
};

export const deleteFormation = async (id: string, branchId: string) => {
    const existing = await prisma.formation.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Formation not found');

    await prisma.formation.delete({ where: { id } });
};

export const getFormationAnalytics = async () => {
    // Aggregate across all branches — intentionally left unscoped, accepted debt.
    const totalFormations = await prisma.formation.count();
    const totalInscriptions = await prisma.inscription.count({
        where: { type: 'FORMATION' }
    });
    const revenue = await prisma.inscription.aggregate({
        where: { type: 'FORMATION' },
        _sum: { amount: true }
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const monthlyRevenue = await prisma.inscription.aggregate({
        where: {
            type: 'FORMATION',
            createdAt: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        },
        _sum: { amount: true }
    });

    const recentInscriptions = await prisma.inscription.findMany({
        where: { type: 'FORMATION' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            student: true
        }
    });

    return {
        totalFormations,
        totalInscriptions,
        totalRevenue: revenue._sum.amount || 0,
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        recentInscriptions
    };
};
