import prisma from '../../config/database';
import { Group, InscriptionType, Prisma } from '@prisma/client';

export interface CreateGroupData {
    name: string;
    type: InscriptionType;
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

export const createGroup = async (data: CreateGroupData) => {
    // Basic validation
    if (data.type === 'FORMATION' && !data.formationId) {
        throw new Error('Formation Group requires a formationId');
    }

    return await prisma.group.create({
        data: {
            name: data.name,
            type: data.type,
            level: data.level,
            subject: data.subject,
            formationId: data.formationId || undefined,
            teacherId: data.teacherId || undefined,
            room: data.room,
            whatsappUrl: data.whatsappUrl,
            timeSlots: data.timeSlots,
            // Connect existing students
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

export const getAllGroups = async (type?: InscriptionType) => {
    const where: Prisma.GroupWhereInput = {};
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

export const getGroupById = async (id: string) => {
    const group = await prisma.group.findUnique({
        where: { id },
        include: {
            teacher: true,
            students: true,
            formation: true
        }
    });

    if (!group) throw new Error('Group not found');
    return group;
};

export const updateGroup = async (id: string, data: UpdateGroupData) => {
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

export const deleteGroup = async (id: string) => {
    return await prisma.group.delete({
        where: { id }
    });
};
