import prisma from '../../config/database';
import { TransactionType } from '@prisma/client';

interface CreateTransactionData {
    type: TransactionType;
    amount: number;
    category: string;
    description?: string;
    date?: Date;
}

export const createTransaction = async (data: CreateTransactionData) => {
    const { type, amount, category, description, date } = data;

    const transaction = await prisma.transaction.create({
        data: {
            type,
            amount,
            category,
            description,
            date: date || new Date(),
        },
    });

    return transaction;
};

export const getAllTransactions = async () => {
    const transactions = await prisma.transaction.findMany({
        orderBy: {
            date: 'desc',
        },
    });

    return transactions;
};

export const getTransactionStats = async () => {
    const transactions = await prisma.transaction.findMany();

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
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    console.log('=== Monthly Transaction Stats Debug ===');
    console.log('Start of month:', startOfMonth);
    console.log('End of month:', endOfMonth);

    const transactions = await prisma.transaction.findMany({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        }
    });

    console.log('Transactions found:', transactions.length);
    transactions.forEach(t => {
        console.log(`- Type: ${t.type}, Amount: ${t.amount}, Date: ${t.date}`);
    });

    const totalIncome = transactions
        .filter(t => t.type === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
        .filter(t => t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    console.log('Total Income:', totalIncome);
    console.log('Total Expense:', totalExpense);
    console.log('Balance:', balance);

    return {
        totalIncome,
        totalExpense,
        balance,
    };
};


export const deleteTransaction = async (id: string) => {
    await prisma.transaction.delete({
        where: { id },
    });
    return { message: 'Transaction deleted successfully' };
};
