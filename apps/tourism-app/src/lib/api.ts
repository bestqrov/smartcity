import { getDirection, supportedLocales } from '@smartcity/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface FetchOptions extends RequestInit {
  locale?: string;
}

export async function apiClient(
  endpoint: string,
  options: FetchOptions = {},
) {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('tourism_access_token')
    : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export function isPublicRoute(pathname: string, locale: string) {
  const route = pathname.replace(`/${locale}`, '');
  const publicRoutes = ['/login', '/register'];
  return publicRoutes.includes(route);
}

export function getLocaleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const locale = segments[0];
  return supportedLocales.includes(locale) ? locale : 'fr';
}

export { getDirection };
