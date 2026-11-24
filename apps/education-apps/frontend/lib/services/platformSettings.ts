'use client';

import { useEffect, useState } from 'react';
import api from '../api';
import type { ApiResponse } from '@/types';

export type SignupPeriod = 'MONTHLY' | 'SEMIANNUAL' | 'YEARLY';
export const SIGNUP_PERIODS: SignupPeriod[] = ['MONTHLY', 'SEMIANNUAL', 'YEARLY'];

export interface PublicPlatformSettings {
    platformName: string;
    supportPhone: string | null;
    supportWhatsapp: string | null;
    supportEmail: string | null;
    signupOpen: boolean;
    signupPeriods: SignupPeriod[];
    trialDays: number;
}

export interface PlatformSettings extends PublicPlatformSettings {
    bannerText: string | null;
    bannerActive: boolean;
}

// The values hardcoded before the settings existed: shown until (or if) the server answers.
export const DEFAULT_PUBLIC_PLATFORM: PublicPlatformSettings = {
    platformName: 'ArwaEduc',
    supportPhone: '+212 608183886',
    supportWhatsapp: '212608183886',
    supportEmail: 'contact@smartecole.com',
    signupOpen: true,
    signupPeriods: SIGNUP_PERIODS,
    trialDays: 15,
};

export async function fetchPublicPlatform(): Promise<PublicPlatformSettings> {
    const response = await api.get<ApiResponse<PublicPlatformSettings>>('/public/platform');
    return response.data.data;
}

// Public platform info for the login and signup pages; falls back to the defaults on any failure.
export function usePublicPlatform(): PublicPlatformSettings {
    const [settings, setSettings] = useState<PublicPlatformSettings>(DEFAULT_PUBLIC_PLATFORM);
    useEffect(() => {
        let cancelled = false;
        fetchPublicPlatform()
            .then((data) => {
                if (!cancelled && data) setSettings({ ...DEFAULT_PUBLIC_PLATFORM, ...data });
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);
    return settings;
}

// wa.me needs digits only.
export const whatsappLink = (number: string) => `https://wa.me/${number.replace(/\D/g, '')}`;

export async function getPlatformSettings(): Promise<PlatformSettings> {
    const response = await api.get<ApiResponse<PlatformSettings>>('/platform/settings');
    return response.data.data;
}

export async function updatePlatformSettings(data: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const response = await api.put<ApiResponse<PlatformSettings>>('/platform/settings', data);
    return response.data.data;
}

export async function getPlatformBanner(): Promise<string | null> {
    const response = await api.get<ApiResponse<{ text: string | null }>>('/platform/banner');
    return response.data.data?.text ?? null;
}
