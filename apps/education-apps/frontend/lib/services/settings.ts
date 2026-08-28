import api from '../api';
import type { Settings, SettingsFormData, ApiResponse } from '@/types';

export async function getSettings(): Promise<Settings> {
    const response = await api.get<ApiResponse<Settings>>('/settings');
    return response.data.data;
}

export async function updateSettings(data: Partial<SettingsFormData>): Promise<Settings> {
    const response = await api.put<ApiResponse<Settings>>('/settings', data);
    return response.data.data;
}
