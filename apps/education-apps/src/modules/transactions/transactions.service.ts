import prisma from '../../config/database';
import { TransactionType } from '@prisma/client';

interface CreateTransactionData {
    type: TransactionType;
    amount: number;
    category: string;
    branchId: string;
    description?: string;
    date?: Date;
}

export const createTransaction = async (data: CreateTransactionData) => {
    const { type, amount, category, branchId, description, date } = data;

    const transaction = await prisma.transaction.create({
        data: {
            type,
            amount,
            category,
            branchId,
            description,
            date: date || new Date(),
        },
    });

    return transaction;
};

export const getAllTransactions = async (branchId: string) => {
    const transactions = await prisma.transaction.findMany({
        where: { branchId },
        orderBy: {
            date: 'desc',
        },
    });

    return transactions;
};

export const getTransactionStats = async (branchId: string) => {
    const transactions = await prisma.transaction.findMany({ where: { branchId } });

    const totalIncome = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    return {
        totalIncome,
        totalExpense,
        balance,
    };
};

export const getMonthlyTransactionStats = async () => {
    // Aggregate across all branches — intentionally left unscoped, accepted debt.
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        }
    });

    const totalIncome = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    return {
        totalIncome,
        totalExpense,
        balance,
    };
};

export const deleteTransaction = async (id: string, branchId: string) => {
    const existing = await prisma.transaction.findFirst({ where: { id, branchId } });
    if (!existing) {
        throw new Error('Transaction not found');
    }

    await prisma.transaction.delete({
        where: { id },
    });
    return { message: 'Transaction deleted successfully' };
};
