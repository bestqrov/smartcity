import prisma from '../../config/database';
import { generateRawToken, hashToken } from '../../utils/accessToken';
import { tuitionPayments } from '../payments/tuitionFilter';
import { currentMonth } from '../transport/month';

export interface CreateParentData {
    name: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    cin?: string;
    address?: string;
}

export const createParent = async (data: CreateParentData) => {
    const rawToken = generateRawToken();

    const parent = await prisma.parent.create({
        data: {
            ...data,
            accessTokenHash: hashToken(rawToken),
        },
    });

    return { parent, rawToken };
};

export const getAllParents = async () => {
    return prisma.parent.findMany({
        include: { students: true },
        orderBy: { createdAt: 'desc' },
    });
};

export const getParentById = async (id: string) => {
    const parent = await prisma.parent.findUnique({
        where: { id },
        include: { students: true },
    });

    if (!parent) {
        throw new Error('Parent not found');
    }

    return parent;
};

export const updateParent = async (id: string, data: Partial<CreateParentData>) => {
    return prisma.parent.update({ where: { id }, data });
};

export const regenerateParentToken = async (id: string) => {
    const rawToken = generateRawToken();

    const parent = await prisma.parent.update({
        where: { id },
        data: { accessTokenHash: hashToken(rawToken) },
    });

    return { parent, rawToken };
};

export const getParentByRawToken = async (rawToken: string) => {
    const accessTokenHash = hashToken(rawToken);

    return prisma.parent.findUnique({
        where: { accessTokenHash },
        include: {
            students: {
                include: {
                    inscriptions: true,
                    payments: tuitionPayments,
                    attendances: true,
                    // Read-only transport summary for the portal: route/stop/subscription scalars are returned; driver is limited to name+phone, vehicle to plate, payments to id.
                    transportSubscriptions: {
                        where: { status: { in: ['ACTIVE', 'PAUSED'] } },
                        include: {
                            route: {
                                include: {
                                    driver: { select: { name: true, phone: true } },
                                    vehicle: { select: { plate: true } },
                                },
                            },
                            stop: true,
                            payments: { where: { forMonth: currentMonth() }, select: { id: true } },
                        },
                    },
                },
            },
        },
    });
};
