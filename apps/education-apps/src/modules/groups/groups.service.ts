import prisma from '../../config/database';
import { InscriptionType, Prisma } from '@prisma/client';

export interface CreateGroupData {
    name: string;
    type: InscriptionType;
    branchId: string;
    level?: string;
    subject?: string;
    formationId?: string;
    teacherId?: string;
    room?: string;
    whatsappUrl?: string;
    studentIds?: string[];
    timeSlots?: any;
}

export interface UpdateGroupData {
    name?: string;
    level?: string;
    subject?: string;
    formationId?: string;
    teacherId?: string;
    room?: string;
    whatsappUrl?: string;
    studentIds?: string[];
    timeSlots?: any;
}

const assertStudentsInBranch = async (studentIds: string[] | undefined, branchId: string) => {
    if (!studentIds || studentIds.length === 0) return;

    const students = await prisma.student.findMany({ where: { id: { in: studentIds } } });
    const allInBranch = students.length === studentIds.length && students.every((s) => s.branchId === branchId);

    if (!allInBranch) {
        throw new Error('One or more students do not belong to this branch');
    }
};

export const createGroup = async (data: CreateGroupData) => {
    if (data.type === 'FORMATION' && !data.formationId) {
        throw new Error('Formation Group requires a formationId');
    }

    await assertStudentsInBranch(data.studentIds, data.branchId);

    return await prisma.group.create({
        data: {
            name: data.name,
            type: data.type,
            branchId: data.branchId,
            level: data.level,
            subject: data.subject,
            formationId: data.formationId || undefined,
            teacherId: data.teacherId || undefined,
            room: data.room,
            whatsappUrl: data.whatsappUrl,
            timeSlots: data.timeSlots,
            students: {
                connect: data.studentIds?.map(id => ({ id })) || []
            }
        },
        include: {
            teacher: true,
            students: true,
            formation: true
        }
    });
};

export const getAllGroups = async (branchId: string, type?: InscriptionType) => {
    const where: Prisma.GroupWhereInput = { branchId };
    if (type) {
        where.type = type;
    }

    return await prisma.group.findMany({
        where,
        include: {
            teacher: true,
            students: true,
            formation: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
};

export const getGroupById = async (id: string, branchId: string) => {
    const group = await prisma.group.findUnique({
        where: { id },
        include: {
            teacher: true,
            students: true,
            formation: true
        }
    });

    if (!group || group.branchId !== branchId) throw new Error('Group not found');
    return group;
};

export const updateGroup = async (id: string, branchId: string, data: UpdateGroupData) => {
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) throw new Error('Group not found');

    await assertStudentsInBranch(data.studentIds, branchId);

    return await prisma.group.update({
        where: { id },
        data: {
            ...data,
            formationId: data.formationId || undefined,
            teacherId: data.teacherId || undefined,
            students: data.studentIds ? {
                set: data.studentIds.map(sid => ({ id: sid }))
            } : undefined
        },
        include: {
            teacher: true,
            students: true,
            formation: true
        }
    });
};

export const deleteGroup = async (id: string, branchId: string) => {
    const existing = await prisma.group.findUnique({ where: { id } });
    if (!existing || existing.branchId !== branchId) throw new Error('Group not found');

    return await prisma.group.delete({
        where: { id }
    });
};
