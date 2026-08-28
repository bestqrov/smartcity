import api from '../api';

export interface PricingItem {
    id?: string;
    category: string;
    level: string;
    subject: string;
    price: number;
    description?: string;
    active?: boolean;
}

export const pricingService = {
    getAll: async (): Promise<PricingItem[]> => {
        const response = await api.get('/pricing');
        return response.data.data;
    },

    getByCategory: async (category: string): Promise<PricingItem[]> => {
        const response = await api.get(`/pricing?category=${category}`);
        return response.data.data;
    },

    create: async (data: PricingItem): Promise<PricingItem> => {
        const response = await api.post('/pricing', data);
        return response.data.data;
    },

    update: async (id: string, data: Partial<PricingItem>): Promise<PricingItem> => {
        const response = await api.put(`/pricing/${id}`, data);
        return response.data.data;
    },

    bulkUpsert: async (items: PricingItem[]): Promise<PricingItem[]> => {
        const response = await api.put('/pricing/bulk', { items });
        return response.data.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/pricing/${id}`);
    }
};
