import { Request, Response } from 'express';
import {
    createPayment,
    getAllPayments,
    getPaymentById,
    getPaymentAnalytics,
} from './payments.service';
import { sendSuccess, sendError } from '../../utils/response';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { studentId, amount, method, note, date } = req.body;

        // Validate required fields
        if (!studentId || amount === undefined || !method) {
            sendError(
                res,
                'StudentId, amount, and method are required',
                'Validation error',
                400
            );
            return;
        }

        const paymentData: any = { studentId, amount, method };
        if (note) paymentData.note = note;
        if (date) paymentData.date = new Date(date);

        const payment = await createPayment(paymentData);

        sendSuccess(res, payment, 'Payment created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create payment', 400);
    }
};

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const payments = await getAllPayments();
        sendSuccess(res, payments, 'Payments retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve payments', 500);
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const payment = await getPaymentById(id);
        sendSuccess(res, payment, 'Payment retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve payment', 404);
    }
};

export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const analytics = await getPaymentAnalytics();
        sendSuccess(res, analytics, 'Payment analytics retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve payment analytics', 500);
    }
};
