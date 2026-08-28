'use client';

import { useEffect, useState } from 'react';
import SecretaryAnalytics from '@/components/dashboard/SecretaryAnalytics';
import useAuthStore from '@/store/useAuthStore';

export default function SecretaryDashboard() {
    const user = useAuthStore(state => state.user);
    const [name, setName] = useState('Secrétaire');

    useEffect(() => {
        if (user) {
            setName(`${user.name} ${user.surname || ''}`.trim());
        }
    }, [user]);

    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
                <p className="text-gray-600 mt-2">Bienvenue sur votre espace, {name}</p>
            </div>

            <SecretaryAnalytics />
        </div>
    );
}
