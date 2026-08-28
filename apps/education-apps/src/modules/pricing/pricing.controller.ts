import { Request, Response } from 'express';
import {
    getAllPricing,
    getPricingByCategory,
    createPricing,
    updatePricing,
    deletePricing,
    bulkUpsertPricing
} from './pricing.service';
import { sendSuccess, sendError } from '../../utils/response';

export const getAll = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category } = req.query;

        let pricing;
        if (category && typeof category === 'string') {
            pricing = await getPricingByCategory(category);
        } else {
            pricing = await getAllPricing();
        }

        sendSuccess(res, pricing, 'Pricing retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve pricing', 500);
    }
};

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const { category, level, subject, price, description } = req.body;

        if (!category || !level || !subject || price === undefined) {
            sendError(res, 'Category, level, subject and price are required', 'Validation error', 400);
            return;
        }

        const pricing = await createPricing({
            category,
            level,
            subject,
            price: parseFloat(price),
            description
        });

        sendSuccess(res, pricing, 'Pricing created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create pricing', 400);
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { category, level, subject, price, description, active } = req.body;

        const updateData: any = {};
        if (category) updateData.category = category;
        if (level) updateData.level = level;
        if (subject) updateData.subject = subject;
        if (price !== undefined) updateData.price = parseFloat(price);
        if (description !== undefined) updateData.description = description;
        if (active !== undefined) updateData.active = active;

        const pricing = await updatePricing(id, updateData);

        sendSuccess(res, pricing, 'Pricing updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update pricing', 400);
    }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        await deletePricing(id);
        sendSuccess(res, null, 'Pricing deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete pricing', 404);
    }
};

export const bulkUpsert = async (req: Request, res: Response): Promise<void> => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items)) {
            sendError(res, 'Items array is required', 'Validation error', 400);
            return;
        }

        const results = await bulkUpsertPricing(items);
        sendSuccess(res, results, 'Pricing bulk updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to bulk update pricing', 400);
    }
};
