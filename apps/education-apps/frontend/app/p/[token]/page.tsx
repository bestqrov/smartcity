'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicParentProfile } from '@/lib/services/parents';
import type { Parent } from '@/types';
import ParentShell from '@/components/parent/ParentShell';

export default function ParentSpacePage() {
    const { token } = useParams<{ token: string }>();
    const [parent, setParent] = useState<Parent | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        getPublicParentProfile(token).then(setParent).catch(() => setError(true));
    }, [token]);

    return <ParentShell token={token} parent={parent} error={error} />;
}
