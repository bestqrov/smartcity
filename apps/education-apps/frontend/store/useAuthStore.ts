// store/useAuthStore.ts
import { create } from 'zustand';
import { User } from '../types';

type AuthState = {
    user: User | null;
    accessToken: string | null;
    loading: boolean;
    setUser: (u: User | null) => void;
    setAccessToken: (t: string | null) => void;
    login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
    logout: () => void;
    getMe: () => Promise<void>;
};

let _accessToken: string | null = null;

export const getAccessToken = () => _accessToken;
export const setAccessToken = (t: string | null) => {
    _accessToken = t;
    if (typeof window !== 'undefined') {
        if (t) localStorage.setItem('accessToken', t);
        else localStorage.removeItem('accessToken');
    }
};
export const clearTokens = () => {
    _accessToken = null;
    if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken');
    }
};

// Initialize token from localStorage
if (typeof window !== 'undefined') {
    _accessToken = localStorage.getItem('accessToken');
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    accessToken: _accessToken,
    loading: false,
    setUser: (u) => set({ user: u }),
    setAccessToken: (t) => { setAccessToken(t); set({ accessToken: t }); },
    login: async (email, password) => {
        try {
            set({ loading: true });
            // Use the axios instance which has baseURL configured
            const { default: api } = await import('../lib/api');

            console.log('Logging in with:', email);

            const res = await api.post('/auth/login', { email, password });
            const data = res.data;

            console.log('Login success:', data);

            // Adapted for backend response: { success: true, data: { token, user } }
            const token = data.data?.token || data.accessToken;
            const user = data.data?.user || data.user;

            setAccessToken(token);
            set({ user: user, accessToken: token });
            return { success: true };
        } catch (err: any) {
            console.error('Login error details:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Network error';
            return { success: false, message: msg };
        } finally { set({ loading: false }); }
    },
    logout: () => {
        clearTokens();
        set({ user: null, accessToken: null });
        if (typeof window !== 'undefined') {
            window.location.href = 'https://appinjahi.techmar.cloud';
        }
    },
    getMe: async () => {
        try {
            const { default: api } = await import('../lib/api');
            const res = await api.get('/auth/me');
            if (res.data.success) {
                set({ user: res.data.data });
            }
        } catch (err) {
            console.error('Failed to fetch user profile:', err);
            // If fetching profile fails (e.g. 401), logout
            get().logout();
        }
    }
}));

// Initialize user if token exists
if (_accessToken) {
    useAuthStore.getState().getMe();
}


export default useAuthStore;
