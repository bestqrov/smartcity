import type { AxiosResponse } from 'axios';
import api from '../api';
import type {
    ApiResponse,
    Driver,
    TransportRoute,
    TransportStop,
    TransportSubscription,
    TransportSubscriptionStatus,
    Vehicle,
} from '@/types';

const unwrap = async <T>(request: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> => (await request).data.data;

// The API puts the specific reason in `error`; `message` is only a generic label.
export const transportErrorMessage = (e: any): string =>
    e?.response?.data?.error || e?.message || 'Une erreur est survenue';

export interface RouteInput {
    name: string;
    vehicleId: string;
    driverId: string;
    monthlyPrice?: number | null;
}

export interface StopInput {
    name: string;
    order: number;
    morningTime: string;
    afternoonTime: string;
    monthlyPrice?: number | null;
}

export interface TransportPaymentInput {
    forMonth: string;
    amount?: number;
    method: string;
    note?: string;
}

export const transportService = {
    vehicles: {
        list: () => unwrap(api.get<ApiResponse<Vehicle[]>>('/transport/vehicles')),
        create: (data: { plate: string; capacity: number }) =>
            unwrap(api.post<ApiResponse<Vehicle>>('/transport/vehicles', data)),
        remove: async (id: string) => {
            await api.delete(`/transport/vehicles/${id}`);
        },
    },
    drivers: {
        list: () => unwrap(api.get<ApiResponse<Driver[]>>('/transport/drivers')),
        create: (data: { name: string; phone: string }) =>
            unwrap(api.post<ApiResponse<Driver>>('/transport/drivers', data)),
        remove: async (id: string) => {
            await api.delete(`/transport/drivers/${id}`);
        },
    },
    routes: {
        list: () => unwrap(api.get<ApiResponse<TransportRoute[]>>('/transport/routes')),
        create: (data: RouteInput) => unwrap(api.post<ApiResponse<TransportRoute>>('/transport/routes', data)),
        remove: async (id: string) => {
            await api.delete(`/transport/routes/${id}`);
        },
        addStop: (routeId: string, data: StopInput) =>
            unwrap(api.post<ApiResponse<TransportStop>>(`/transport/routes/${routeId}/stops`, data)),
        removeStop: async (routeId: string, stopId: string) => {
            await api.delete(`/transport/routes/${routeId}/stops/${stopId}`);
        },
    },
    subscriptions: {
        list: (status?: TransportSubscriptionStatus) =>
            unwrap(
                api.get<ApiResponse<TransportSubscription[]>>('/transport/subscriptions', {
                    params: status ? { status } : undefined,
                })
            ),
        forStudent: (studentId: string) =>
            unwrap(api.get<ApiResponse<TransportSubscription | null>>(`/transport/subscriptions/student/${studentId}`)),
        create: (data: { studentId: string; routeId: string; stopId: string }) =>
            unwrap(api.post<ApiResponse<TransportSubscription>>('/transport/subscriptions', data)),
        pause: (id: string) => unwrap(api.post<ApiResponse<TransportSubscription>>(`/transport/subscriptions/${id}/pause`)),
        resume: (id: string) => unwrap(api.post<ApiResponse<TransportSubscription>>(`/transport/subscriptions/${id}/resume`)),
        end: (id: string) => unwrap(api.post<ApiResponse<TransportSubscription>>(`/transport/subscriptions/${id}/end`)),
        pay: (id: string, data: TransportPaymentInput) =>
            unwrap(api.post<ApiResponse<{ id: string }>>(`/transport/subscriptions/${id}/payments`, data)),
    },
    dues: (month?: string) =>
        unwrap(api.get<ApiResponse<TransportSubscription[]>>('/transport/dues', { params: month ? { month } : undefined })),
};
