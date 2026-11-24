'use client';

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { getPlatformBanner } from '@/lib/services/platformSettings';

// Message from the platform (set by the super admin) at the top of the school staff dashboards.
export default function PlatformBanner() {
    const [text, setText] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        getPlatformBanner()
            .then((value) => {
                if (!cancelled) setText(value);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);
    if (!text) return null;
    return (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100">
            <Megaphone size={18} className="mt-0.5 shrink-0" />
            <p className="whitespace-pre-line">{text}</p>
        </div>
    );
}
