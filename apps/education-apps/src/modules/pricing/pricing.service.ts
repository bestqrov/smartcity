import prisma from '../../config/database';

export interface PricingData {
    category: string;
    level: string;
    subject: string;
    price: number;
    description?: string;
    active?: boolean;
}

export const getAllPricing = async () => {
    return await prisma.pricing.findMany({
        where: { active: true },
        orderBy: [
            { category: 'asc' },
            { level: 'asc' },
            { subject: 'asc' }
        ]
    });
};

export const getPricingByCategory = async (category: string) => {
    return await prisma.pricing.findMany({
        where: {
            category,
            active: true
        },
        orderBy: [
            { level: 'asc' },
            { subject: 'asc' }
        ]
    });
};

export const getPriceForSubject = async (category: string, level: string, subject: string): Promise<number> => {
    const pricing = await prisma.pricing.findFirst({
        where: {
            category,
            level,
            subject,
            active: true
        }
    });
    return pricing?.price || 0;
};

export const createPricing = async (data: PricingData) => {
    return await prisma.pricing.create({
        data: {
            category: data.category,
            level: data.level,
            subject: data.subject,
            price: data.price,
            description: data.description,
            active: data.active ?? true
        }
    });
};

export const updatePricing = async (id: string, data: Partial<PricingData>) => {
    return await prisma.pricing.update({
        where: { id },
        data
    });
};

export const deletePricing = async (id: string) => {
    return await prisma.pricing.update({
        where: { id },
        data: { active: false }
    });
};

export const upsertPricing = async (data: PricingData) => {
    const existing = await prisma.pricing.findFirst({
        where: {
            category: data.category,
            level: data.level,
            subject: data.subject
        }
    });

    if (existing) {
        return await prisma.pricing.update({
            where: { id: existing.id },
            data: { price: data.price, active: true }
        });
    } else {
        return await createPricing(data);
    }
};

export const bulkUpsertPricing = async (items: PricingData[]) => {
    const results = [];
    for (const item of items) {
        const result = await upsertPricing(item);
        results.push(result);
    }
    return results;
};
