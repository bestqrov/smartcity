import prisma from '../../config/database';
import { createTransaction, getMonthlyTransactionStats } from '../transactions/transactions.service';
import { calculateMonthlyTeacherExpenses } from '../teachers/teachers.service';

interface CreatePaymentData {
    studentId: string;
    branchId: string;
    amount: number;
    method: string;
    note?: string;
    date?: Date;
}

export const createPayment = async (data: CreatePaymentData) => {
    const { studentId, branchId, amount, method, note, date } = data;

    const student = await prisma.student.findUnique({
        where: { id: studentId },
    });

    if (!student || student.branchId !== branchId) {
        throw new Error('Student not found');
    }

    const payment = await prisma.payment.create({
        data: {
            studentId,
            branchId,
            amount,
            method,
            note,
            date: date || new Date(),
        },
        include: {
            student: true,
        },
    });

    await createTransaction({
        type: 'INCOME',
        amount: amount,
        category: 'Paiement Scolarité',
        description: `Paiement de ${student.name} ${student.surname} (${method})`,
        date: date || new Date(),
    } as any);

    return payment;
};

export const getAllPayments = async (branchId: string) => {
    const payments = await prisma.payment.findMany({
        where: { branchId },
        include: {
            student: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return payments;
};

export const getPaymentById = async (id: string, branchId: string) => {
    const payment = await prisma.payment.findFirst({
        where: { id, branchId },
        include: {
            student: true,
        },
    });

    if (!payment) {
        throw new Error('Payment not found');
    }

    return payment;
};

export const getPaymentAnalytics = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const paymentsThisMonth = await prisma.payment.aggregate({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        },
        _sum: {
            amount: true
        }
    });

    const totalReceived = paymentsThisMonth._sum.amount || 0;

    const transactionStats = await getMonthlyTransactionStats();
    const teacherExpenses = await calculateMonthlyTeacherExpenses();
    const totalExpenses = transactionStats.totalExpense;

    return {
        totalReceivedMonth: totalReceived,
        totalExpenses: totalExpenses,
        totalIncome: transactionStats.totalIncome,
        teacherExpenses: teacherExpenses.totalTeacherExpenses,
        otherExpenses: transactionStats.totalExpense
    };
};
