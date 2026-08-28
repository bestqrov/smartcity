import api from './api';
import { setAccessToken, clearTokens } from '../store/useAuthStore';
import type { LoginRequest, LoginResponse, RegisterAdminRequest, User } from '@/types';

// Login
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/login', credentials);

    const { token, user } = response.data.data;

    // Store tokens
    setAccessToken(token);
    // Note: Backend doesn't provide separate refresh token yet
    // Using same token as refresh for now
    // setRefreshToken(token); // Removed as it doesn't exist

    return { token, user };
}

// Register admin (first-time setup)
export async function registerAdmin(data: RegisterAdminRequest): Promise<User> {
    const response = await api.post<{ success: boolean; data: User }>('/auth/register-admin', data);
    return response.data.data;
}

// Logout
export function logout() {
    clearTokens();
}

// Get current user
export async function getMe(): Promise<User> {
    const response = await api.get<{ success: boolean; data: User }>('/auth/me');
    return response.data.data;
}

// Check if admin exists (for showing register link)
export async function checkAdminExists(): Promise<boolean> {
    try {
        const response = await api.get<{ success: boolean; data: { exists: boolean } }>('/auth/admin-exists');
        return response.data.data.exists;
    } catch (error) {
        // If endpoint doesn't exist, assume admin exists
        return true;
    }
}
