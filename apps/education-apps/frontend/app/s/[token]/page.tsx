'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, Clock, MapPin, User, Phone, Wallet, BookOpen, History } from 'lucide-react';
import { getPublicStudentProfile } from '@/lib/services/students';
import type { Student, Attendance } from '@/types';

const DAY_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const statusBadge = (status: Attendance['status']) => {
    if (status === 'PRESENT') return { label: 'Présent', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    if (status === 'LATE') return { label: 'En retard', className: 'bg-amber-50 text-amber-700 border-amber-100' };
    return { label: 'Absent', className: 'bg-red-50 text-red-700 border-red-100' };
};

export default function StudentPublicProfilePage() {
    const { token } = useParams<{ token: string }>();
    const [student, setStudent] = useState<Student | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        getPublicStudentProfile(token).then(setStudent).catch(() => setError(true));
    }, [token]);

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
                <p className="text-center text-red-600 dark:text-red-400">Lien introuvable ou expiré.</p>
            </div>
        );
    }

    if (!student) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
                <p className="text-center text-slate-500 dark:text-slate-400">Chargement…</p>
            </div>
        );
    }

    const balanceDue =
        (student.inscriptions || []).reduce((sum, i) => sum + i.amount, 0) -
        (student.payments || []).reduce((sum, p) => sum + p.amount, 0);

    const todayAttendance = (student.attendances || []).find(
        (a) => new Date(a.date).toDateString() === new Date().toDateString()
    );

    const allSlots = (student.groups || [])
        .flatMap((g) => (g.timeSlots || []).map((slot) => ({ ...slot, groupName: g.name, subject: g.subject })))
        .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime));

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <div className="mx-auto max-w-md space-y-5 p-5 pb-12">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                        {student.name} {student.surname}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">{student.schoolLevel || '—'}</p>
                </div>

                {/* Today + balance */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {todayAttendance ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadge(todayAttendance.status).className}`}>
                            {statusBadge(todayAttendance.status).label} aujourd'hui
                        </span>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Aucune présence enregistrée aujourd'hui</p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                        <Wallet size={16} className="text-slate-400" />
                        <p className="font-semibold text-slate-900 dark:text-white">Solde dû : {balanceDue} MAD</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        N'inclut pas les frais mensuels récurrents — contactez l'établissement pour le détail complet.
                    </p>
                </div>

                {/* Mes cours */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                        <BookOpen size={16} className="text-blue-500" />
                        <h2 className="font-bold text-slate-900 dark:text-white">Mes cours</h2>
                    </div>
                    {(student.groups || []).length === 0 ? (
                        <p className="text-sm text-slate-400">Aucun cours assigné pour l'instant.</p>
                    ) : (
                        <div className="space-y-3">
                            {(student.groups || []).map((g) => (
                                <div key={g.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                                    <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                        {g.subject || g.name} {g.level ? <span className="text-slate-400 font-normal">— {g.level}</span> : null}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                        {g.teacher && (
                                            <span className="flex items-center gap-1"><User size={11} /> {g.teacher.name}</span>
                                        )}
                                        {g.room && (
                                            <span className="flex items-center gap-1"><MapPin size={11} /> {g.room}</span>
                                        )}
                                        {g.teacher?.phone && (
                                            <span className="flex items-center gap-1"><Phone size={11} /> {g.teacher.phone}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Emploi du temps */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                        <CalendarDays size={16} className="text-indigo-500" />
                        <h2 className="font-bold text-slate-900 dark:text-white">Emploi du temps</h2>
                    </div>
                    {allSlots.length === 0 ? (
                        <p className="text-sm text-slate-400">Aucun horaire configuré pour l'instant.</p>
                    ) : (
                        <div className="space-y-1.5">
                            {allSlots.map((slot, i) => (
                                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{slot.day}</span>
                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                        <Clock size={12} /> {slot.startTime} – {slot.endTime}
                                    </span>
                                    <span className="text-xs text-slate-400">{slot.subject || slot.groupName}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Historique de présence */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                        <History size={16} className="text-slate-500" />
                        <h2 className="font-bold text-slate-900 dark:text-white">Historique de présence</h2>
                    </div>
                    {(student.attendances || []).length === 0 ? (
                        <p className="text-sm text-slate-400">Aucune présence enregistrée.</p>
                    ) : (
                        <div className="space-y-1.5 max-h-72 overflow-y-auto">
                            {(student.attendances || []).map((a) => (
                                <div key={a.id} className="flex items-center justify-between text-sm py-1">
                                    <span className="text-slate-600 dark:text-slate-300">
                                        {new Date(a.date).toLocaleDateString('fr-FR')}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${statusBadge(a.status).className}`}>
                                        {statusBadge(a.status).label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
