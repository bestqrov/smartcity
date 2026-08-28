import { Request, Response } from 'express';
import {
    createTransaction,
    getAllTransactions,
    getTransactionStats,
    deleteTransaction,
} from './transactions.service';
import { sendSuccess, sendError } from '../../utils/response';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('--- Create Transaction Request ---');
        console.log('Body:', req.body);
        console.log('Headers:', req.headers);

        const { type, amount, category, description, date } = req.body;

        if (!type || !amount || !category) {
            sendError(res, 'Type, amount, and category are required', 'Validation error', 400);
            return;
        }

        const transaction = await createTransaction({
            type,
            amount: parseFloat(amount),
            category,
            description,
            date: date ? new Date(date) : undefined,
        });

        sendSuccess(res, transaction, 'Transaction created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create transaction', 400);
    }
};

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const transactions = await getAllTransactions();
        sendSuccess(res, transactions, 'Transactions retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve transactions', 500);
    }
};

export const getStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = await getTransactionStats();
        sendSuccess(res, stats, 'Transaction stats retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve stats', 500);
    }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await deleteTransaction(id);
        sendSuccess(res, result, 'Transaction deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete transaction', 400);
    }
};
