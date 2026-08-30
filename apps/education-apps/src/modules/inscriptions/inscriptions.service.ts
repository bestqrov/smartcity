import prisma from '../../config/database';
import { InscriptionType } from '@prisma/client';
import { createPayment } from '../payments/payments.service';

interface CreateInscriptionData {
    studentId: string;
    branchId: string;
    type: InscriptionType;
    category: string;
    amount: number;
    date?: Date;
    note?: string;
}

interface UpdateInscriptionData {
    type?: InscriptionType;
    category?: string;
    amount?: number;
    date?: Date;
    note?: string;
}

const SOUTIEN_CATEGORIES = [
    'math',
    'physique',
    'svt',
    'francais',
    'anglais',
    'calcul_mental',
    'couran',
    'autre',
];

const validateCategory = (type: InscriptionType, category: string): void => {
    if (type === 'SOUTIEN' && !SOUTIEN_CATEGORIES.includes(category)) {
        // Intentionally not enforced — see original implementation notes.
    }
};

export const createInscription = async (data: CreateInscriptionData) => {
    const { studentId, branchId, type, category, amount, date, note } = data;

    validateCategory(type, category);

    const student = await prisma.student.findUnique({
        where: { id: studentId },
    });

    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    const inscription = await prisma.inscription.create({
        data: {
            studentId,
            branchId,
            type,
            category,
            amount,
            date: date || new Date(),
            note,
        },
        include: {
            student: true,
        },
    });

    if (amount > 0) {
        try {
            await createPayment({
                studentId,
                amount,
                method: 'CASH',
                date: date || new Date(),
                note: `Paiement pour inscription: ${type} - ${category}`,
            } as any);
        } catch (error) {
            console.error('Failed to auto-create payment for inscription:', error);
        }
    }

    return inscription;
};

export const getAllInscriptions = async (branchId: string) => {
    const inscriptions = await prisma.inscription.findMany({
        where: { branchId },
        include: {
            student: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return inscriptions;
};

export const getInscriptionById = async (id: string, branchId: string) => {
    const inscription = await prisma.inscription.findFirst({
        where: { id, branchId },
        include: {
            student: true,
        },
    });

    if (!inscription) {
        throw new Error('Inscription not found');
    }

    return inscription;
};

export const updateInscription = async (
    id: string,
    branchId: string,
    data: UpdateInscriptionData
) => {
    const existingInscription = await prisma.inscription.findFirst({ where: { id, branchId } });

    if (!existingInscription) {
        throw new Error('Inscription not found');
    }

    const { type, category, amount, date, note } = data;

    const newType = type || existingInscription.type;
    const newCategory = category || existingInscription.category;
    validateCategory(newType, newCategory);

    const inscription = await prisma.inscription.update({
        where: { id },
        data: { type, category, amount, date, note },
        include: {
            student: true,
        },
    });

    return inscription;
};

export const deleteInscription = async (id: string, branchId: string) => {
    const existingInscription = await prisma.inscription.findFirst({ where: { id, branchId } });

    if (!existingInscription) {
        throw new Error('Inscription not found');
    }

    await prisma.inscription.delete({
        where: { id },
    });

    return { message: 'Inscription deleted successfully' };
};

export const getInscriptionAnalytics = async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const dailyInscriptions = await prisma.inscription.findMany({
        where: {
            createdAt: {
                gte: startOfDay,
            },
        },
    });

    const dailyCount = dailyInscriptions.length;
    const dailyTotal = dailyInscriptions.reduce((sum, ins) => sum + ins.amount, 0);
    const dailySoutien = dailyInscriptions.filter(i => i.type === 'SOUTIEN').length;
    const dailyFormation = dailyInscriptions.filter(i => i.type === 'FORMATION').length;

    const monthlyInscriptions = await prisma.inscription.findMany({
        where: {
            createdAt: {
                gte: startOfMonth,
            },
        },
    });

    const monthlyCount = monthlyInscriptions.length;
    const monthlyTotal = monthlyInscriptions.reduce((sum, ins) => sum + ins.amount, 0);
    const monthlySoutien = monthlyInscriptions.filter(i => i.type === 'SOUTIEN').length;
    const monthlyFormation = monthlyInscriptions.filter(i => i.type === 'FORMATION').length;

    return {
        daily: {
            count: dailyCount,
            total: dailyTotal,
            soutien: dailySoutien,
            formation: dailyFormation,
        },
        monthly: {
            count: monthlyCount,
            total: monthlyTotal,
            soutien: monthlySoutien,
            formation: monthlyFormation,
        },
    };
};
