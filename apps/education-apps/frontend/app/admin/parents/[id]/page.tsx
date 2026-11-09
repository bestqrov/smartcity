'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Baby, KeyRound, Mail, MapPin, Phone } from 'lucide-react';
import { getParentById, regenerateParentToken } from '@/lib/services/parents';
import type { Parent } from '@/types';
import PortalLinkCard from '@/components/PortalLinkCard';
import { parentPortalMessage, publicUrl } from '@/lib/publicUrl';

export default function ParentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const [parent, setParent] = useState<Parent | null>(null);
    const [rawToken, setRawToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getParentById(id)
            .then(setParent)
            .catch(() => setParent(null))
            .finally(() => setLoading(false));
    }, [id]);

    const handleRegenerate = async () => {
        if (
            !window.confirm(
                "Un nouveau lien va être créé. L'ancien lien (et l'ancien QR code) du parent ne fonctionnera plus. Continuer ?"
            )
        ) {
            return;
        }
        setRegenerating(true);
        setError(null);
        try {
            const result = await regenerateParentToken(id);
            setParent((prev) => (prev ? { ...prev, ...result.parent, students: prev.students } : prev));
            setRawToken(result.rawToken);
        } catch {
            setError("Impossible de créer un nouveau lien. Réessayez.");
        } finally {
            setRegenerating(false);
        }
    };

    if (loading) return <p className="p-6 text-slate-500">Chargement…</p>;
    if (!parent) return <p className="p-6 text-slate-500">Parent introuvable.</p>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Link href="/admin/parents" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 dark:text-slate-400">
                <ArrowLeft size={16} /> Parents
            </Link>

            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{parent.name}</h1>
                <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                    <span className="inline-flex items-center gap-2"><Phone size={16} /> {parent.phone}</span>
                    {parent.whatsapp && <span className="inline-flex items-center gap-2"><Phone size={16} /> WhatsApp : {parent.whatsapp}</span>}
                    {parent.email && <span className="inline-flex items-center gap-2"><Mail size={16} /> {parent.email}</span>}
                    {parent.address && <span className="inline-flex items-center gap-2"><MapPin size={16} /> {parent.address}</span>}
                </div>

                <div>
                    <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                        <Baby size={18} /> Enfants
                    </h2>
                    {parent.students.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Aucun enfant lié. Liez ce parent depuis la fiche de l&apos;élève pour qu&apos;il voie ses informations.
                        </p>
                    ) : (
                        <ul className="flex flex-wrap gap-2">
                            {parent.students.map((student) => (
                                <li key={student.id}>
                                    <Link
                                        className="inline-block rounded-xl bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-700"
                                        href={`/admin/students/${student.id}`}
                                    >
                                        {student.name} {student.surname}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
                <div>
                    <h2 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                        <KeyRound size={18} /> Accès parent (sans mot de passe)
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Le parent ouvre ce lien (ou scanne le QR code) pour suivre la présence, les paiements et les annonces.
                        Par sécurité, le lien n&apos;est affiché qu&apos;une fois : s&apos;il est perdu, créez-en un nouveau.
                    </p>
                </div>

                {rawToken ? (
                    <PortalLinkCard
                        title="Nouveau lien du parent"
                        url={publicUrl(`/p/${rawToken}`)}
                        phone={parent.whatsapp || parent.phone}
                        message={parentPortalMessage(parent.name)}
                        warning="Envoyez-le ou imprimez-le maintenant : il ne sera plus affiché après avoir quitté cette page."
                    />
                ) : (
                    <button
                        type="button"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {regenerating ? 'Création…' : 'Créer un nouveau lien d’accès'}
                    </button>
                )}
                {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
            </div>
        </div>
    );
}
