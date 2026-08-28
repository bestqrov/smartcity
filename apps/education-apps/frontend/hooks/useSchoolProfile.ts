import { useState, useEffect } from 'react';

export interface SchoolProfile {
    schoolName: string;
    logo?: string | null;
    logoUrl?: string | null;
    director?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
}

export function useSchoolProfile() {
    const [profile, setProfile] = useState<SchoolProfile>({
        schoolName: 'Smart School', // Default until a school configures its own profile
        logo: null
    });
    const [loading, setLoading] = useState(true);

    const loadProfile = () => {
        try {
            const savedProfile = localStorage.getItem('school-profile');
            if (savedProfile) {
                const parsed = JSON.parse(savedProfile);
                setProfile({
                    ...parsed,
                    schoolName: parsed.schoolName || 'Smart School',
                    logo: parsed.logo || parsed.logoUrl || null // Handle both legacy keys
                });
            }
        } catch (error) {
            console.error('Failed to load school profile:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();

        // Listen for updates from other components
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'school-profile') {
                loadProfile();
            }
        };

        // Custom event for same-window updates
        const handleCustomUpdate = () => loadProfile();

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('school-profile-updated', handleCustomUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('school-profile-updated', handleCustomUpdate);
        };
    }, []);

    return { profile, loading, refreshProfile: loadProfile };
}
