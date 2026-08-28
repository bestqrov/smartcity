import api from '../api';

export interface Secretary {
    id: string;
    email: string;
    name: string;
    role: string;
    gsm?: string;
    whatsapp?: string;
    address?: string;
    schoolLevel?: string;
    certification?: string;
    createdAt: string;
}

interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

export const secretaryService = {
    getSecretaries: async () => {
        const response = await api.get<ApiResponse<Secretary[]>>('/users/secretaries');
        return response.data.data;
    },

    updateSecretary: async (id: string, data: {
        email?: string;
        password?: string;
        name?: string;
        gsm?: string;
        whatsapp?: string;
        address?: string;
        schoolLevel?: string;
        certification?: string;
    }) => {
        const response = await api.put<ApiResponse<Secretary>>(`/users/secretaries/${id}`, data);
        return response.data.data;
    },
};
