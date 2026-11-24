'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { getStudentById, regenerateStudentToken, regenerateStudentPortalToken } from '@/lib/services/students';
import type { Student } from '@/types';
import { ATTENDANCE_META, formatTime } from '@/lib/attendanceStatus';
import QrCodeCard from '@/components/QrCodeCard';
import { publicUrl } from '@/lib/publicUrl';
import StudentTransportCard from '@/components/transport/StudentTransportCard';

import { appLocale, useI18n } from '@/lib/i18n/I18nProvider';
import { hasFeature } from '@/lib/packs';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { levelLabel } from '@/lib/levels';
import { LEVELS } from '@/lib/schoolLevels';
import StudentSchoolInfo from '@/components/school-mode/StudentSchoolInfo';
type Tab = 'attendance' | 'finance' | 'inscriptions' | 'info';

const TABS: { key: Tab; label: string }[] = [
    { key: 'attendance', label: 'Présences' },
    { key: 'finance', label: 'Finances' },
    { key: 'inscriptions', label: 'Inscriptions' },
    { key: 'info', label: 'Informations' },
];

export default function StudentProfilePage() {
    const { tr } = useI18n();
    const { profile: schoolProfile } = useSchoolProfile(); // pack options decide which actions show
    const { id } = useParams<{ id: string }>();
    const base = usePathname()?.startsWith('/secretary') ? '/secretary' : '/admin';
    const [student, setStudent] = useState<Student | null>(null);
    const [tab, setTab] = useState<Tab>('attendance');
    const [rawToken, setRawToken] = useState<string | null>(null);
    const [rawPortalToken, setRawPortalToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getStudentById(id).then((data) => {
            setStudent(data);
            setLoading(false);
        });
    }, [id]);

    const handleRegenerate = async () => {
        if (!window.confirm(tr("This will invalidate the student's current attendance card immediately. Continue?"))) {
            return;
        }
        const result = await regenerateStudentToken(id);
        setStudent(result.student);
        setRawToken(result.rawToken);
    };

    const handleRegeneratePortal = async () => {
        if (!window.confirm(tr("Ceci invalidera immédiatement l'ancien lien de profil de l'élève. Continuer ?"))) {
            return;
        }
        const result = await regenerateStudentPortalToken(id);
        setStudent(result.student);
        setRawPortalToken(result.rawToken);
    };

    if (loading) return <div className="p-6">{tr("Chargement…")}</div>;
    if (!student) return <div className="p-6">{tr("Élève introuvable")}</div>;

    // Private school students (catalog level) have the full inscription file.
    const schoolFile = LEVELS.some((l) => l.code === student.schoolLevel);

    // Monthly payments are not inscriptions: paying them must not show a negative balance due.
    const balanceDue = Math.max(
        0,
        (student.inscriptions || []).reduce((sum, i) => sum + i.amount, 0) -
            (student.payments || []).filter((p) => !p.forMonth).reduce((sum, p) => sum + p.amount, 0)
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {student.name} {student.surname}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">{tr(levelLabel(student.schoolLevel)) || '—'}</p>
                </div>
                <div className="flex gap-2">
                    {schoolFile && (
                        <Link href={`${base}/students/${student.id}/dossier`} className="rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200">{tr('Imprimer le dossier')}</Link>
                    )}
                    {hasFeature(schoolProfile.features, 'STUDENT_PORTAL') && (
                        <button
                            className="rounded-xl bg-slate-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-slate-700"
                            onClick={handleRegeneratePortal}
                        >{tr("Générer le lien de profil élève")}</button>
                    )}
                    {hasFeature(schoolProfile.features, 'QR_ATTENDANCE') && (
                        <button
                            className="rounded-xl bg-blue-600 px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                            onClick={handleRegenerate}
                        >{tr("Régénérer le QR de présence")}</button>
                    )}
                </div>
            </div>

            {rawPortalToken && (
                <QrCodeCard
                    title={tr("Nouveau lien de profil élève — à partager avec l'élève, ne sera plus affiché")}
                    url={publicUrl(`/s/${rawPortalToken}`)}
                />
            )}

            {rawToken && (
                <QrCodeCard
                    title={tr("Nouveau jeton de présence — réservé au personnel scanneur")}
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
                            {tr(label)}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {tab === 'attendance' && (
                        <ul className="space-y-2">
                            {(student.attendances || []).length === 0 && (
                                <p className="text-slate-500">{tr("Aucune présence enregistrée.")}</p>
                            )}
                            {(student.attendances || []).map((a) => (
                                <li
                                    key={a.id}
                                    className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-2"
                                >
                                    <span>
                                        {new Date(a.date).toLocaleDateString(appLocale())}
                                        {a.slotStart && <span className="text-slate-500"> · {a.slotStart}</span>}
                                        {a.scannedAt && <span className="text-slate-500">{' '}{tr("(scanné à")}{' '}{formatTime(a.scannedAt)})</span>}
                                        {a.note && <span className="block text-xs text-slate-500">« {a.note} »</span>}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${ATTENDANCE_META[a.status].badge}`}>
                                        {tr(ATTENDANCE_META[a.status].label)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {tab === 'finance' && (
                        <div className="space-y-4">
                            <p className="font-medium text-slate-900 dark:text-white">{tr("Solde dû (inscriptions vs. paiements) :")}{" "}{balanceDue}{" "}{tr("MAD")}<span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{tr("N'inclut pas les frais mensuels récurrents — voir les analyses du tableau de bord pour le revenu total.")}</span>
                            </p>
                            <ul className="space-y-2">
                                {(student.payments || []).length === 0 && (
                                    <p className="text-slate-500">{tr("Aucun paiement enregistré.")}</p>
                                )}
                                {(student.payments || []).map((p) => (
                                    <li
                                        key={p.id}
                                        className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-2"
                                    >
                                        <span>{new Date(p.date).toLocaleDateString()}</span>
                                        <span className="font-medium">
                                            {p.amount}{' '}{tr("MAD (")}{tr(p.method)})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {tab === 'inscriptions' && (
                        <ul className="space-y-2">
                            {(student.inscriptions || []).length === 0 && (
                                <p className="text-slate-500">{tr("Aucune inscription enregistrée.")}</p>
                            )}
                            {(student.inscriptions || []).map((i) => (
                                <li
                                    key={i.id}
                                    className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-2"
                                >
                                    <span>
                                        {i.type} — {i.category}
                                    </span>
                                    <span className="font-medium">{i.amount}{' '}{tr("MAD")}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {tab === 'info' && (
                        <div className="space-y-2">
                            <p>
                                <span className="text-slate-500">{tr("Téléphone :")}{' '}</span>
                                {student.phone || '—'}
                            </p>
                            <p>
                                <span className="text-slate-500">{tr("CIN :")}{' '}</span>
                                {student.cin || '—'}
                            </p>
                            <p>
                                <span className="text-slate-500">{tr("Adresse :")}{' '}</span>
                                {student.address || '—'}
                            </p>
                            {student.parent ? (
                                <p>
                                    <span className="text-slate-500">{tr("Parent :")}{' '}</span>
                                    <a
                                        className="text-blue-600 hover:underline"
                                        href={`/admin/parents/${student.parent.id}`}
                                    >
                                        {student.parent.name}
                                    </a>
                                </p>
                            ) : (
                                <p>
                                    <span className="text-slate-500">{tr("Parent :")}{' '}</span>
                                    {student.parentName || '—'} ({student.parentPhone || '—'})
                                </p>
                            )}
                        </div>
                    )}

                    {tab === 'info' && schoolFile && <StudentSchoolInfo student={student} onSaved={setStudent} />}

                    {tab === 'info' && (student.crecheSection || student.healthNotes || (student.authorizedPickup && student.authorizedPickup.length > 0)) && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                            <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">{tr("Crèche")}</h2>
                            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                {student.crecheSection && (
                                    <p><span className="text-slate-500">{tr("Section :")}{' '}</span>{student.crecheSection}</p>
                                )}
                                {student.massarNumber && (
                                    <p><span className="text-slate-500">{tr("Massar :")}{' '}</span>{student.massarNumber}</p>
                                )}
                                {student.healthNotes && (
                                    <p><span className="text-slate-500">{tr("Santé :")}{' '}</span>{student.healthNotes}</p>
                                )}
                                {student.authorizedPickup && student.authorizedPickup.length > 0 && (
                                    <div>
                                        <span className="text-slate-500">{tr("Personnes autorisées :")}{' '}</span>
                                        <ul className="mt-1 list-disc list-inside">
                                            {student.authorizedPickup.map((p, i) => (
                                                <li key={i}>{typeof p === 'string' ? p : <>{p.name} — <bdi dir="ltr">{p.phone}</bdi> ({p.relation})</>}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <StudentTransportCard studentId={id} />
        </div>
    );
}
