
import api from '../api';
import type { User, ApiResponse } from '@/types';


export const getAllUsers = async (): Promise<User[]> => {
    const response = await api.get<ApiResponse<User[]>>('/users');
    return response.data.data;
};

export const getSecretaries = async (): Promise<User[]> => {
    const response = await api.get<ApiResponse<User[]>>('/users/secretaries');
    return response.data.data;
};

export const createUser = async (data: any): Promise<User> => {
    const response = await api.post<ApiResponse<User>>('/users', data);
    return response.data.data;
};

export const updateUser = async (id: string, data: any): Promise<User> => {
    const response = await api.put<ApiResponse<User>>(`/users/${id}`, data);
    return response.data.data;
};

export const deleteUser = async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
};

