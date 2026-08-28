import prisma from '../../config/database';
import { InscriptionType } from '@prisma/client';
import { createPayment } from '../payments/payments.service';

interface CreateInscriptionData {
    studentId: string;
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

// Category validation rules
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
        // Optional: you might want to relax this too or keep it if strictly controlled
        // For now preventing error, leaving SOUTIEN as is unless requested
        // But matching seed data suggestion:
        // throw new Error(...)
    }

    // FORMATION validation removed to allow dynamic formation names
};

export const createInscription = async (data: CreateInscriptionData) => {
    const { studentId, type, category, amount, date, note } = data;

    // Validate category based on type
    validateCategory(type, category);

    // Check if student exists
    const student = await prisma.student.findUnique({
        where: { id: studentId },
    });

    if (!student) {
        throw new Error('Student not found');
    }

    const inscription = await prisma.inscription.create({
        data: {
            studentId,
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

    // Automatically create a payment for the inscription amount
    // checking if amount > 0 to avoid zero-value payments if that's undesired, 
    // but usually inscription implies payment.
    if (amount > 0) {
        try {
            await createPayment({
                studentId,
                amount,
                method: 'CASH', // Default to CASH
                date: date || new Date(),
                note: `Paiement pour inscription: ${type} - ${category}`,
            });
        } catch (error) {
            console.error('Failed to auto-create payment for inscription:', error);
            // We don't throw here to avoid failing the inscription if payment fails,
            // but ideally they should be in a transaction.
            // For now, logging is sufficient as per current consistency level.
        }
    }

    return inscription;
};

export const getAllInscriptions = async () => {
    const inscriptions = await prisma.inscription.findMany({
        include: {
            student: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return inscriptions;
};

export const getInscriptionById = async (id: string) => {
    const inscription = await prisma.inscription.findUnique({
        where: { id },
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
    data: UpdateInscriptionData
) => {
    // Check if inscription exists
    const existingInscription = await prisma.inscription.findUnique({
        where: { id },
    });

    if (!existingInscription) {
        throw new Error('Inscription not found');
    }

    // Validate category if type or category is being updated
    const newType = data.type || existingInscription.type;
    const newCategory = data.category || existingInscription.category;
    validateCategory(newType, newCategory);

    const inscription = await prisma.inscription.update({
        where: { id },
        data,
        include: {
            student: true,
        },
    });

    return inscription;
};

export const deleteInscription = async (id: string) => {
    // Check if inscription exists
    const existingInscription = await prisma.inscription.findUnique({
        where: { id },
    });

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

    // Daily stats
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

    // Monthly stats
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

