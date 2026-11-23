'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    CalendarDays, Clock, MapPin, User, Phone, Wallet, BookOpen, History,
    LayoutDashboard, GraduationCap, ArrowDownCircle, ArrowUpCircle, Users,
    Megaphone, CalendarOff, MessageCircle,
} from 'lucide-react';
import { getPublicStudentProfile } from '@/lib/services/students';
import type { Student, Attendance } from '@/types';
import { ATTENDANCE_META } from '@/lib/attendanceStatus';
import LangSwitcher from '@/components/LangSwitcher';
import { I18nProvider, appLocale, useI18n } from '@/lib/i18n/I18nProvider';
import { levelLabel } from '@/lib/levels';

const DAY_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const statusBadge = (status: Attendance['status']) => ({
    label: ATTENDANCE_META[status].label,
    className: ATTENDANCE_META[status].badge,
});

type TabKey = 'dashboard' | 'payment' | 'courses' | 'groups' | 'schedule' | 'presence';

const NAV_ITEMS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
    { key: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { key: 'payment', label: 'Paiements', icon: Wallet },
    { key: 'courses', label: 'Mes cours', icon: BookOpen },
    { key: 'groups', label: 'Mes groupes', icon: Users },
    { key: 'schedule', label: 'Emploi du temps', icon: CalendarDays },
    { key: 'presence', label: 'Présence', icon: History },
];

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${className}`}>
        {children}
    </div>
);

// The student chooses French or Arabic (FR / ع), kept on this device like in the other spaces.
export default function StudentPublicProfilePage() {
    return (
        <I18nProvider>
            <StudentSpace />
        </I18nProvider>
    );
}

function StudentSpace() {
    const { tr } = useI18n();
    const { token } = useParams<{ token: string }>();
    const [student, setStudent] = useState<Student | null>(null);
    const [error, setError] = useState(false);
    const [tab, setTab] = useState<TabKey>('dashboard');

    useEffect(() => {
        getPublicStudentProfile(token).then(setStudent).catch(() => setError(true));
    }, [token]);

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
                <p className="text-center text-red-600 dark:text-red-400">{tr("Lien introuvable ou expiré.")}</p>
            </div>
        );
    }

    if (!student) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-900">
                <p className="text-center text-slate-500 dark:text-slate-400">{tr("Chargement…")}</p>
            </div>
        );
    }

    const totalPayable = (student.inscriptions || []).reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = (student.payments || []).reduce((sum, p) => sum + p.amount, 0);
    // Monthly payments are not inscriptions: paying them must not show a negative balance due.
    const balanceDue = Math.max(0, totalPayable - totalPaid);

    const todayAttendance = (student.attendances || []).find(
        (a) => new Date(a.date).toDateString() === new Date().toDateString()
    );

    const allSlots = (student.groups || [])
        .flatMap((g) => (g.timeSlots || []).map((slot) => ({ ...slot, groupName: g.name, subject: g.subject })))
        .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime));

    const initials = `${student.name?.[0] || ''}${student.surname?.[0] || ''}`.toUpperCase();

    const todayLabel = new Date().toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex">
            {/* Sidebar */}
            <aside className="hidden md:flex flex-col w-64 shrink-0 bg-gradient-to-b from-violet-600 to-violet-700 rounded-e-3xl py-8 px-5">
                <div className="flex justify-center mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center overflow-hidden">
                        {student.school?.logo ? (
                            <img src={student.school.logo} alt={student.school.name} className="w-full h-full object-contain p-1.5" />
                        ) : (
                            <GraduationCap size={30} className="text-white" />
                        )}
                    </div>
                </div>
                <nav className="flex-1 space-y-1.5">
                    {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                tab === key ? 'bg-white text-violet-700' : 'text-violet-100 hover:bg-white/10'
                            }`}
                        >
                            <Icon size={18} />
                            {tr(label)}
                        </button>
                    ))}
                </nav>

                {student.school?.phone && (
                    <a
                        href={`tel:${student.school.phone}`}
                        className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-violet-100 hover:bg-white/20 transition-colors text-sm"
                    >
                        <Phone size={18} className="shrink-0" />
                        <div className="min-w-0">
                            <p className="font-semibold text-white text-xs">{tr("Besoin d'aide ?")}</p>
                            <p className="truncate"><bdi dir="ltr">{student.school.phone}</bdi></p>
                        </div>
                    </a>
                )}
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">
                <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-8">
                    {/* Topbar */}
                    <div className="flex items-center justify-between">
                        <h1 className="md:hidden text-lg font-bold text-slate-900 dark:text-white">
                            {student.name} {student.surname}
                        </h1>
                        <div className="hidden md:flex items-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
                            {student.school?.name && (
                                <>
                                    {student.school.logo && (
                                        <img
                                            src={student.school.logo}
                                            alt={student.school.name}
                                            className="w-7 h-7 rounded-full object-contain bg-white border border-slate-200 dark:border-slate-700 p-0.5"
                                        />
                                    )}
                                    <span>{tr("Rester en contact avec")}</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{student.school.name}</span>
                                    {student.school.phone && (
                                        <span className="flex items-center gap-1.5 ms-1">
                                            <a
                                                href={`tel:${student.school.phone}`}
                                                title={tr("Appeler")}
                                                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                                            >
                                                <Phone size={14} />
                                            </a>
                                            <a
                                                href={`https://wa.me/${student.school.phone.replace(/[^0-9]/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={tr("WhatsApp")}
                                                className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                            >
                                                <MessageCircle size={14} />
                                            </a>
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <LangSwitcher />
                            <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">
                                {initials}
                            </div>
                            <div className="text-end">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{student.name} {student.surname}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{tr(levelLabel(student.schoolLevel)) || '—'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Welcome banner */}
                    <div className="rounded-3xl bg-gradient-to-r from-violet-600 to-violet-500 p-6 md:p-8 text-white">
                        <p className="text-violet-100 text-sm mb-2">{todayLabel}</p>
                        <h2 className="text-2xl md:text-3xl font-bold mb-2">{tr("Bienvenue,")}{' '}{student.name} !</h2>
                        <p className="text-violet-100">{tr("Restez à jour dans votre espace étudiant.")}</p>
                    </div>

                    {tab === 'dashboard' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Card className="flex flex-col items-center text-center py-6">
                                    <ArrowUpCircle className="text-violet-500 mb-3" size={28} />
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{totalPayable}{' '}{tr("MAD")}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr("Total à payer")}</p>
                                </Card>
                                <Card className="flex flex-col items-center text-center py-6 border-2 border-violet-500">
                                    <ArrowDownCircle className="text-violet-500 mb-3" size={28} />
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{totalPaid}{' '}{tr("MAD")}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr("Total payé")}</p>
                                </Card>
                                <Card className="flex flex-col items-center text-center py-6">
                                    <Wallet className="text-violet-500 mb-3" size={28} />
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{balanceDue}{' '}{tr("MAD")}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr("Solde dû")}</p>
                                </Card>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold text-slate-900 dark:text-white">{tr("Mes cours")}</h3>
                                    <button onClick={() => setTab('courses')} className="text-violet-600 text-sm font-medium hover:underline">{tr("Voir tout")}</button>
                                </div>
                                {(student.groups || []).length === 0 ? (
                                    <Card><p className="text-sm text-slate-400">{tr("Aucun cours assigné pour l'instant.")}</p></Card>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {(student.groups || []).slice(0, 2).map((g) => (
                                            <Card key={g.id} className="border-2 border-violet-100">
                                                <p className="font-semibold text-slate-900 dark:text-white text-sm mb-1">
                                                    {g.subject ? tr(g.subject) : g.name}
                                                </p>
                                                <p className="text-xs text-slate-400 mb-3">{tr(levelLabel(g.level)) || '—'}</p>
                                                <button
                                                    onClick={() => setTab('courses')}
                                                    className="px-4 py-1.5 rounded-full bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700"
                                                >{tr("Voir")}</button>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Card>
                                <div className="flex items-center gap-2 mb-3">
                                    <History size={16} className="text-violet-500" />
                                    <h3 className="font-bold text-slate-900 dark:text-white">{tr("Présence aujourd'hui")}</h3>
                                </div>
                                {todayAttendance ? (
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadge(todayAttendance.status).className}`}>
                                        {tr(statusBadge(todayAttendance.status).label)}
                                    </span>
                                ) : (
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr("Aucune présence enregistrée aujourd'hui")}</p>
                                )}
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Megaphone size={16} className="text-violet-500" />
                                        <h3 className="font-bold text-slate-900 dark:text-white">{tr("Annonces")}</h3>
                                    </div>
                                    {(student.announcements || []).length === 0 ? (
                                        <p className="text-sm text-slate-400">{tr("Aucune annonce pour l'instant.")}</p>
                                    ) : (
                                        <div className="space-y-3 max-h-64 overflow-y-auto">
                                            {(student.announcements || []).map((a) => (
                                                <div key={a.id} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0 pb-3 last:pb-0">
                                                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{a.title}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 whitespace-pre-wrap">{a.body}</p>
                                                    <p className="text-[11px] text-slate-400 mt-1">{new Date(a.createdAt).toLocaleDateString(appLocale())}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                                <Card>
                                    <div className="flex items-center gap-2 mb-3">
                                        <CalendarOff size={16} className="text-violet-500" />
                                        <h3 className="font-bold text-slate-900 dark:text-white">{tr("Prochaines vacances")}</h3>
                                    </div>
                                    {(student.holidays || []).length === 0 ? (
                                        <p className="text-sm text-slate-400">{tr("Aucune période de congé à venir.")}</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {(student.holidays || []).map((h) => (
                                                <div key={h.id} className="flex items-center justify-between text-sm py-1">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{h.title}</span>
                                                    <span className="text-xs text-slate-400">
                                                        <bdi dir="ltr">{new Date(h.startDate).toLocaleDateString(appLocale())} – {new Date(h.endDate).toLocaleDateString(appLocale())}</bdi>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                    )}

                    {tab === 'payment' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Card className="flex flex-col items-center text-center py-6">
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{totalPayable}{' '}{tr("MAD")}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr("Total à payer")}</p>
                                </Card>
                                <Card className="flex flex-col items-center text-center py-6">
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{totalPaid}{' '}{tr("MAD")}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr("Total payé")}</p>
                                </Card>
                                <Card className="flex flex-col items-center text-center py-6 border-2 border-violet-500">
                                    <p className="text-xl font-bold text-slate-900 dark:text-white">{balanceDue}{' '}{tr("MAD")}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">{tr("Solde dû")}</p>
                                </Card>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{tr("N'inclut pas les frais mensuels récurrents — contactez l'établissement pour le détail complet.")}</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">{tr("Inscriptions")}</h3>
                                    {(student.inscriptions || []).length === 0 ? (
                                        <p className="text-sm text-slate-400">{tr("Aucune inscription.")}</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {(student.inscriptions || []).map((i) => (
                                                <div key={i.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                                                    <div>
                                                        <p className="font-medium text-slate-700 dark:text-slate-300">{tr(i.category)}</p>
                                                        <p className="text-xs text-slate-400">{new Date(i.date).toLocaleDateString(appLocale())}</p>
                                                    </div>
                                                    <span className="font-semibold text-slate-900 dark:text-white">{i.amount}{' '}{tr("MAD")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                                <Card>
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">{tr("Paiements")}</h3>
                                    {(student.payments || []).length === 0 ? (
                                        <p className="text-sm text-slate-400">{tr("Aucun paiement enregistré.")}</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {(student.payments || []).map((p) => (
                                                <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                                                    <div>
                                                        <p className="font-medium text-slate-700 dark:text-slate-300">{tr(p.method)}</p>
                                                        <p className="text-xs text-slate-400">{new Date(p.date).toLocaleDateString(appLocale())}</p>
                                                    </div>
                                                    <span className="font-semibold text-emerald-600">+{p.amount}{' '}{tr("MAD")}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </div>
                        </div>
                    )}

                    {tab === 'courses' && (
                        <Card>
                            <div className="flex items-center gap-2 mb-3">
                                <BookOpen size={16} className="text-violet-500" />
                                <h2 className="font-bold text-slate-900 dark:text-white">{tr("Mes cours")}</h2>
                            </div>
                            {(student.groups || []).length === 0 ? (
                                <p className="text-sm text-slate-400">{tr("Aucun cours assigné pour l'instant.")}</p>
                            ) : (
                                <div className="space-y-3">
                                    {(student.groups || []).map((g) => (
                                        <div key={g.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                                            <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                                {g.subject ? tr(g.subject) : g.name} {g.level ? <span className="text-slate-400 font-normal">— {tr(levelLabel(g.level))}</span> : null}
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
                        </Card>
                    )}

                    {tab === 'groups' && (
                        <Card>
                            <div className="flex items-center gap-2 mb-3">
                                <Users size={16} className="text-violet-500" />
                                <h2 className="font-bold text-slate-900 dark:text-white">{tr("Mes groupes")}</h2>
                            </div>
                            {(student.groups || []).length === 0 ? (
                                <p className="text-sm text-slate-400">{tr("Aucun groupe assigné pour l'instant.")}</p>
                            ) : (
                                <div className="space-y-4">
                                    {(student.groups || []).map((g) => {
                                        const groupSlots = [...(g.timeSlots || [])].sort(
                                            (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime)
                                        );
                                        return (
                                            <div key={g.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3">
                                                <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                                    {g.subject ? tr(g.subject) : g.name} {g.level ? <span className="text-slate-400 font-normal">— {tr(levelLabel(g.level))}</span> : null}
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
                                                <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50">
                                                    {groupSlots.length === 0 ? (
                                                        <p className="text-xs text-slate-400">{tr("Aucun horaire configuré pour ce groupe.")}</p>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            {groupSlots.map((slot, i) => (
                                                                <div key={i} className="flex items-center justify-between text-xs">
                                                                    <span className="font-medium text-slate-700 dark:text-slate-300">{tr(slot.day)}</span>
                                                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                                        <Clock size={11} /> <bdi dir="ltr">{slot.startTime} – {slot.endTime}</bdi>
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    )}

                    {tab === 'schedule' && (
                        <Card>
                            <div className="flex items-center gap-2 mb-3">
                                <CalendarDays size={16} className="text-violet-500" />
                                <h2 className="font-bold text-slate-900 dark:text-white">{tr("Emploi du temps")}</h2>
                            </div>
                            {allSlots.length === 0 ? (
                                <p className="text-sm text-slate-400">{tr("Aucun horaire configuré pour l'instant.")}</p>
                            ) : (
                                <div className="space-y-1.5">
                                    {allSlots.map((slot, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 dark:border-slate-700/50 last:border-0">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">{tr(slot.day)}</span>
                                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                <Clock size={12} /> <bdi dir="ltr">{slot.startTime} – {slot.endTime}</bdi>
                                            </span>
                                            <span className="text-xs text-slate-400">{slot.subject ? tr(slot.subject) : slot.groupName}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {tab === 'presence' && (
                        <Card>
                            <div className="flex items-center gap-2 mb-3">
                                <History size={16} className="text-violet-500" />
                                <h2 className="font-bold text-slate-900 dark:text-white">{tr("Historique de présence")}</h2>
                            </div>
                            {(student.attendances || []).length === 0 ? (
                                <p className="text-sm text-slate-400">{tr("Aucune présence enregistrée.")}</p>
                            ) : (
                                <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
                                    {(student.attendances || []).map((a) => (
                                        <div key={a.id} className="flex items-center justify-between text-sm py-1">
                                            <span className="text-slate-600 dark:text-slate-300">
                                                {new Date(a.date).toLocaleDateString(appLocale())}
                                                {a.slotStart && <span className="text-slate-400"> · {a.slotStart}</span>}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${statusBadge(a.status).className}`}>
                                                {tr(statusBadge(a.status).label)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Mobile tab bar */}
                    <div className="md:hidden fixed bottom-0 start-0 end-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex justify-around py-2">
                        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setTab(key)}
                                className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
                                    tab === key ? 'text-violet-600' : 'text-slate-400'
                                }`}
                            >
                                <Icon size={18} />
                                {tr(label)}
                            </button>
                        ))}
                    </div>
                    <div className="md:hidden h-14" />
                </div>
            </div>
        </div>
    );
}
