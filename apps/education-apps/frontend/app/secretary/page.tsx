'use client';

import { useEffect, useState } from 'react';
import SecretaryAnalytics from '@/components/dashboard/SecretaryAnalytics';
import useAuthStore from '@/store/useAuthStore';
import { greeting, todayLabel } from '@/lib/dashboard/vibrant';

import { useI18n } from '@/lib/i18n/I18nProvider';
export default function SecretaryDashboard() {
    const { tr } = useI18n();
    const user = useAuthStore(state => state.user);
    const [name, setName] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name || '');
        }
    }, [user]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    {greeting()}{name ? `${tr(',')} ${name}` : ''}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 first-letter:uppercase">{todayLabel()}{' '}• {tr('Espace secrétaire')}</p>
            </div>

            <SecretaryAnalytics />
        </div>
    );
}
