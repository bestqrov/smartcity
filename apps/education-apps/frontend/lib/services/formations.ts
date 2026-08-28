import api from '../api';

export interface Formation {
    id: string;
    name: string;
    duration: string;
    price: number;
    description?: string;
}

export const formationsService = {
    getAll: async () => {
        const response = await api.get<Formation[]>('/formations');
        return response.data;
    },

    create: async (data: Omit<Formation, 'id'>) => {
        const response = await api.post<Formation>('/formations', data);
        return response.data;
    },

    update: async (id: string, data: Partial<Formation>) => {
        const response = await api.put<Formation>(`/formations/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/formations/${id}`);
    },

    getAnalytics: async () => {
        const response = await api.get<{
            totalFormations: number;
            totalInscriptions: number;
            totalRevenue: number;
            monthlyRevenue: number;
            recentInscriptions: any[];
        }>('/formations/analytics');
        return response.data;
    },
};
