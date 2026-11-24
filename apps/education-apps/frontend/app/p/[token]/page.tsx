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
    const [notInPack, setNotInPack] = useState(false);

    useEffect(() => {
        getPublicParentProfile(token)
            .then(setParent)
            .catch((err) => {
                // The school's pack has no parent portal: say so rather than "link not found".
                setNotInPack(err?.response?.data?.error === 'FEATURE_NOT_IN_PACK');
                setError(true);
            });
    }, [token]);

    return <ParentShell token={token} parent={parent} error={error} notInPack={notInPack} />;
}
