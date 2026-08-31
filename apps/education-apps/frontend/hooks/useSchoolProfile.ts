import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { getAccessToken } from '@/store/useAuthStore';

export interface SchoolProfile {
    schoolName: string;
    logo?: string | null;
    logoUrl?: string | null;
    director?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
    trialEndsAt?: string | null;
}

const DEFAULT_PROFILE: SchoolProfile = {
    schoolName: 'Smart School',
    logo: null,
};

export function useSchoolProfile() {
    const [profile, setProfile] = useState<SchoolProfile>(DEFAULT_PROFILE);
    const [loading, setLoading] = useState(true);

    const loadFromCache = () => {
        try {
            const savedProfile = localStorage.getItem('school-profile');
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                setProfile({
                    ...parsed,
                    schoolName: parsed.schoolName || 'Smart School',
                    logo: parsed.logo || parsed.logoUrl || null,
                });
            }
        } catch (error) {
            console.error('Failed to load cached school profile:', error);
        }
    };

    const loadProfile = useCallback(async () => {
        if (!getAccessToken()) {
            loadFromCache();
            setLoading(false);
            return;
        }

        try {
            const response = await api.get('/schools/me');
            const school = response.data.data;
            const next: SchoolProfile = {
                schoolName: school.name || 'Smart School',
                logo: school.logo || null,
                director: school.director || '',
                email: school.email || '',
                phone: school.phone || '',
                address: school.address || '',
                city: school.city || '',
                status: school.status,
                trialEndsAt: school.trialEndsAt,
            };
            setProfile(next);
            localStorage.setItem('school-profile', JSON.stringify(next));
        } catch (error) {
            console.error('Failed to fetch school profile, falling back to cache:', error);
            loadFromCache();
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'school-profile') {
                loadFromCache();
            }
        };
        const handleCustomUpdate = () => loadProfile();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('school-profile-updated', handleCustomUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('school-profile-updated', handleCustomUpdate);
        };
    }, [loadProfile]);

    return { profile, loading, refreshProfile: loadProfile };
}
