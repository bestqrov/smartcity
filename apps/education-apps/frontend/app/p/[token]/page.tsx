'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPublicParentProfile } from '@/lib/services/parents';
import type { Parent, Student, Attendance } from '@/types';

const statusBadge = (status: Attendance['status'] | undefined) => {
    if (status === 'PRESENT') return { label: 'Présent', className: 'text-emerald-600 dark:text-emerald-400' };
    if (status === 'LATE') return { label: 'En retard', className: 'text-amber-600 dark:text-amber-400' };
    if (status === 'ABSENT') return { label: 'Absent', className: 'text-red-600 dark:text-red-400' };
    return { label: 'Aucune présence enregistrée aujourd’hui', className: 'text-slate-500 dark:text-slate-400' };
};

const studentBalance = (student: Student) =>
    (student.inscriptions || []).reduce((sum, i) => sum + i.amount, 0) -
    (student.payments || []).reduce((sum, p) => sum + p.amount, 0);

export default function ParentPublicProfilePage() {
    const { token } = useParams<{ token: string }>();
    const [parent, setParent] = useState<Parent | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        getPublicParentProfile(token).then(setParent).catch(() => setError(true));
    }, [token]);

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
                <p className="text-center text-red-600 dark:text-red-400">
                    Lien introuvable ou expiré.
                </p>
            </div>
        );
    }

    if (!parent) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
                <p className="text-center text-slate-500 dark:text-slate-400">Chargement…</p>
            </div>
        );
    }

    const totalBalanceDue = parent.students.reduce((sum, student) => sum + studentBalance(student), 0);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <div className="mx-auto max-w-md space-y-6 p-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">{parent.name}</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        {parent.students.length} enfant{parent.students.length > 1 ? 's' : ''}
                    </p>
                    <p className="mt-2 font-medium text-slate-900 dark:text-white">
                        Solde total dû : {totalBalanceDue} MAD
                        <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                            N&apos;inclut pas les frais mensuels récurrents — contactez l&apos;établissement pour le
                            détail complet.
                        </span>
                    </p>
                </div>

                <div className="space-y-3">
                    {parent.students.map((student) => {
                        const todayAttendance = (student.attendances || []).find(
                            (a) => new Date(a.date).toDateString() === new Date().toDateString()
                        );
                        const badge = statusBadge(todayAttendance?.status);
                        const due = studentBalance(student);

                        return (
                            <div
                                key={student.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                                <p className="font-medium text-slate-900 dark:text-white">
                                    {student.name} {student.surname}
                                </p>
                                <p className={`text-sm font-medium ${badge.className}`}>{badge.label}</p>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    Solde dû : {due} MAD
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
