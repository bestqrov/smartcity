// lib/api.ts
import axios from "axios";
import { getAccessToken, setAccessToken, clearTokens } from "../store/useAuthStore";

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000" });

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const originalRequest = err.config;
        if (err.response && err.response.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axios(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Backend doesn't support refresh yet, but keeping structure
                // const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/auth/refresh`, {}, { withCredentials: true });
                // const newToken = res.data.accessToken;
                // setAccessToken(newToken);
                // processQueue(null, newToken);
                // originalRequest.headers.Authorization = `Bearer ${newToken}`;
                // return axios(originalRequest);

                // For now, just logout on 401
                // Don't redirect if we are on the login page or trying to login
                if (originalRequest.url?.includes('/auth/login')) {
                    return Promise.reject(err);
                }

                throw new Error("Session expired");
            } catch (e) {
                processQueue(e, null);
                clearTokens();
                if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                    window.location.href = 'https://appinjahi.techmar.cloud';
                }
                return Promise.reject(e);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(err);
    }
);

export default api;
