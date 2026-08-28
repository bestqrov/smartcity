'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getStudentById, regenerateStudentToken } from '@/lib/services/students';
import type { Student } from '@/types';
import QrCodeCard from '@/components/QrCodeCard';

type Tab = 'attendance' | 'finance' | 'inscriptions' | 'info';

const TABS: { key: Tab; label: string }[] = [
    { key: 'attendance', label: 'Présences' },
    { key: 'finance', label: 'Finances' },
    { key: 'inscriptions', label: 'Inscriptions' },
    { key: 'info', label: 'Informations' },
];

export default function StudentProfilePage() {
    const { id } = useParams<{ id: string }>();
    const [student, setStudent] = useState<Student | null>(null);
    const [tab, setTab] = useState<Tab>('attendance');
    const [rawToken, setRawToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getStudentById(id).then((data) => {
            setStudent(data);
            setLoading(false);
        });
    }, [id]);

    const handleRegenerate = async () => {
        if (!window.confirm("This will invalidate the student's current attendance card immediately. Continue?")) {
            return;
        }
        const result = await regenerateStudentToken(id);
        setStudent(result.student);
        setRawToken(result.rawToken);
    };

    if (loading) return <div className="p-6">Chargement…</div>;
    if (!student) return <div className="p-6">Élève introuvable</div>;

    const balanceDue =
        (student.inscriptions || []).reduce((sum, i) => sum + i.amount, 0) -
        (student.payments || []).reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {student.name} {student.surname}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{student.schoolLevel || '—'}</p>
                </div>
                <button
                    className="rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                    onClick={handleRegenerate}
                >
                    Régénérer le QR de présence
                </button>
            </div>

            {rawToken && (
                <QrCodeCard
                    title="Nouveau jeton de présence — réservé au personnel scanneur"
                    url={rawToken}
                />
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex gap-2 border-b border-slate-100 dark:border-slate-700 px-4">
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            className={`px-3 py-3 text-sm font-medium transition-colors border-b-2 ${
                                tab === key
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                            onClick={() => setTab(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {tab === 'attendance' && (
                        <ul className="space-y-2">
                            {(student.attendances || []).length === 0 && (
                                <p className="text-slate-500">Aucune présence enregistrée.</p>
                            )}
                            {(student.attendances || []).map((a) => (
                                <li
                                    key={a.id}
                                    className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-2"
                                >
                                    <span>{new Date(a.date).toLocaleDateString()}</span>
                                    <span className="font-medium">{a.status}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {tab === 'finance' && (
                        <div className="space-y-4">
                            <p className="font-medium text-slate-900 dark:text-white">
                                Solde dû (inscriptions vs. paiements) : {balanceDue} MAD
                                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                                    N'inclut pas les frais mensuels récurrents — voir les analyses du
                                    tableau de bord pour le revenu total.
                                </span>
                            </p>
                            <ul className="space-y-2">
                                {(student.payments || []).length === 0 && (
                                    <p className="text-slate-500">Aucun paiement enregistré.</p>
                                )}
                                {(student.payments || []).map((p) => (
                                    <li
                                        key={p.id}
                                        className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-2"
                                    >
                                        <span>{new Date(p.date).toLocaleDateString()}</span>
                                        <span className="font-medium">
                                            {p.amount} MAD ({p.method})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {tab === 'inscriptions' && (
                        <ul className="space-y-2">
                            {(student.inscriptions || []).length === 0 && (
                                <p className="text-slate-500">Aucune inscription enregistrée.</p>
                            )}
                            {(student.inscriptions || []).map((i) => (
                                <li
                                    key={i.id}
                                    className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-2"
                                >
                                    <span>
                                        {i.type} — {i.category}
                                    </span>
                                    <span className="font-medium">{i.amount} MAD</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {tab === 'info' && (
                        <div className="space-y-2">
                            <p>
                                <span className="text-slate-500">Téléphone : </span>
                                {student.phone || '—'}
                            </p>
                            <p>
                                <span className="text-slate-500">CIN : </span>
                                {student.cin || '—'}
                            </p>
                            <p>
                                <span className="text-slate-500">Adresse : </span>
                                {student.address || '—'}
                            </p>
                            {student.parent ? (
                                <p>
                                    <span className="text-slate-500">Parent : </span>
                                    <a
                                        className="text-blue-600 hover:underline"
                                        href={`/admin/parents/${student.parent.id}`}
                                    >
                                        {student.parent.name}
                                    </a>
                                </p>
                            ) : (
                                <p>
                                    <span className="text-slate-500">Parent : </span>
                                    {student.parentName || '—'} ({student.parentPhone || '—'})
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
