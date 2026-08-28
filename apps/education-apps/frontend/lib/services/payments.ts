import api from '../api';
import type { Payment, PaymentFormData, ApiResponse } from '@/types';

export async function getPayments(): Promise<Payment[]> {
    const response = await api.get<ApiResponse<Payment[]>>('/payments');
    return response.data.data;
}

export async function getPaymentById(id: string): Promise<Payment> {
    const response = await api.get<ApiResponse<Payment>>(`/payments/${id}`);
    return response.data.data;
}

export async function createSalaryPayment(data: any): Promise<any> {
    const response = await api.post('/payments/salary', data);
    return response.data.data;
}

export async function createPayment(data: PaymentFormData): Promise<Payment> {
    const response = await api.post<ApiResponse<Payment>>('/payments', data);
    return response.data.data;
}

export async function getPaymentAnalytics() {
    const response = await api.get<ApiResponse<{
        totalReceivedMonth: number;
    }>>('/payments/analytics');
    return response.data.data;
}
