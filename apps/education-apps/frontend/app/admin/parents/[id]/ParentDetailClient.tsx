'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getParentById, regenerateParentToken } from '@/lib/services/parents';
import type { Parent } from '@/types';
import QrCodeCard from '@/components/QrCodeCard';

export default function ParentDetailClient() {
    const { id } = useParams<{ id: string }>();
    const [parent, setParent] = useState<Parent | null>(null);
    const [rawToken, setRawToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getParentById(id).then((data) => {
            setParent(data);
            setLoading(false);
        });
    }, [id]);

    const handleRegenerate = async () => {
        const result = await regenerateParentToken(id);
        setParent(result.parent);
        setRawToken(result.rawToken);
    };

    if (loading) return <div className="p-6">Loading…</div>;
    if (!parent) return <div className="p-6">Parent not found</div>;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-xl font-semibold">{parent.name}</h1>
                <p className="text-gray-500">{parent.phone}</p>
            </div>

            <div>
                <h2 className="mb-2 font-medium">Children</h2>
                <ul className="space-y-1">
                    {parent.students.map((student) => (
                        <li key={student.id}>
                            <a className="text-blue-600 hover:underline" href={`/admin/students/${student.id}`}>
                                {student.name} {student.surname}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="space-y-3">
                <button
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    onClick={handleRegenerate}
                >
                    Regenerate access QR
                </button>
                {rawToken && (
                    <QrCodeCard
                        title="New parent access link — save or print now, it will not be shown again"
                        url={`${process.env.NEXT_PUBLIC_FRONTEND_URL || ''}/p/${rawToken}`}
                    />
                )}
            </div>
        </div>
    );
}
