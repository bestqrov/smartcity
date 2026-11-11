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

// Every staff-side parent operation is limited to the caller's branch: a parent's access link
// opens their children's attendance, payments and transport details, so another school must
// never be able to list, edit or re-issue it.

export const createParent = async (data: CreateParentData & { branchId: string }) => {
    const rawToken = generateRawToken();

    const parent = await prisma.parent.create({
        data: {
            ...data,
            accessTokenHash: hashToken(rawToken),
        },
    });

    return { parent, rawToken };
};

export const getAllParents = async (branchId: string) => {
    return prisma.parent.findMany({
        where: { branchId },
        include: { students: { where: { branchId } } },
        orderBy: { createdAt: 'desc' },
    });
};

const findOwnParent = async (id: string, branchId: string) => {
    let parent;
    try {
        parent = await prisma.parent.findFirst({
            where: { id, branchId },
            include: { students: { where: { branchId } } },
        });
    } catch {
        parent = null; // malformed ObjectId
    }

    if (!parent) {
        throw new Error('Parent not found');
    }

    return parent;
};

export const getParentById = async (id: string, branchId: string) => findOwnParent(id, branchId);

export const updateParent = async (id: string, branchId: string, data: Partial<CreateParentData>) => {
    await findOwnParent(id, branchId);
    const { name, phone, whatsapp, email, cin, address } = data;
    return prisma.parent.update({ where: { id }, data: { name, phone, whatsapp, email, cin, address } });
};

export const regenerateParentToken = async (id: string, branchId: string) => {
    await findOwnParent(id, branchId);
    const rawToken = generateRawToken();

    const parent = await prisma.parent.update({
        where: { id },
        data: { accessTokenHash: hashToken(rawToken) },
    });

    return { parent, rawToken };
};

/** Throws unless the parent exists in this branch — used before linking a student to it. */
export const assertParentInBranch = async (parentId: string | null | undefined, branchId: string) => {
    if (!parentId) return;
    await findOwnParent(parentId, branchId);
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
