'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarCheck2, GraduationCap, Home, LinkIcon, MessageCircle, Phone, School, Wallet, type LucideIcon } from 'lucide-react';
import type { Parent, ParentActivity, ParentNotification } from '@/types';
import { PARENT_MESSAGES } from '@/lib/parent/messages';
import { useParentLang } from '@/lib/parent/useParentLang';
import { initials } from '@/lib/parent/helpers';
import { whatsappNumber } from '@/lib/publicUrl';
import HomeTab from './HomeTab';
import AttendanceTab from './AttendanceTab';
import PaymentsTab from './PaymentsTab';
import SchoolTab from './SchoolTab';
import GradesTab from './GradesTab';
import InstallBanner from './InstallBanner';
import HomeworkSection from './HomeworkSection';
import NotificationsSheet from './NotificationsSheet';
import { getParentNotifications } from '@/lib/services/parents';
import { Card, EmptyState, Ltr } from './ui';

type Tab = 'home' | 'attendance' | 'payments' | 'grades' | 'school';
const TABS: { id: Tab; icon: LucideIcon }[] = [
    { id: 'home', icon: Home },
    { id: 'attendance', icon: CalendarCheck2 },
    { id: 'payments', icon: Wallet },
    { id: 'grades', icon: GraduationCap },
    { id: 'school', icon: School },
];

/** Follows the phone's light/dark setting (the staff theme toggle doesn't exist here). */
function useSystemDark() {
    useEffect(() => {
        const root = document.documentElement;
        const had = root.classList.contains('dark');
        const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
        const apply = () => root.classList.toggle('dark', !!mq?.matches);
        apply();
        mq?.addEventListener?.('change', apply);
        return () => {
            mq?.removeEventListener?.('change', apply);
            root.classList.toggle('dark', had);
        };
    }, []);
}

function Skeleton() {
    const bar = 'animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800';
    return (
        <div className="space-y-4 p-4" aria-busy="true">
            <div className="flex gap-2">
                <div className={`${bar} h-9 w-24 !rounded-full`} />
                <div className={`${bar} h-9 w-24 !rounded-full`} />
            </div>
            <div className={`${bar} h-40 !rounded-3xl`} />
            <div className="grid grid-cols-2 gap-3">
                <div className={`${bar} h-28 !rounded-3xl`} />
                <div className={`${bar} h-28 !rounded-3xl`} />
            </div>
            <div className={`${bar} h-32 !rounded-3xl`} />
        </div>
    );
}

interface Props {
    token: string;
    parent: Parent | null;
    error: boolean;
}

export default function ParentShell({ token, parent: loaded, error }: Props) {
    // Local copy so activity answers can be applied optimistically.
    const [parent, setParent] = useState<Parent | null>(loaded);
    useEffect(() => setParent(loaded), [loaded]);
    const [unread, setUnread] = useState(0);
    useEffect(() => setUnread(loaded?.unreadNotifications ?? 0), [loaded]);
    // Keep the bell fresh: on focus / tab shown, and every 60 s while visible.
    useEffect(() => {
        if (!token || !loaded) return;
        let alive = true;
        const refresh = () => {
            if (document.visibilityState !== 'visible') return;
            getParentNotifications(token, { limit: 1 })
                .then((r) => alive && setUnread(r.unread))
                .catch(() => undefined);
        };
        const timer = window.setInterval(refresh, 60_000);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            alive = false;
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [token, loaded]);
    const [inboxOpen, setInboxOpen] = useState(false);
    const setActivities = useCallback(
        (updater: (prev: ParentActivity[]) => ParentActivity[]) => setParent((p) => (p ? { ...p, activities: updater(p.activities || []) } : p)),
        [],
    );
    const [lang, setLang] = useParentLang();
    const t = PARENT_MESSAGES[lang];
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const [tab, setTab] = useState<Tab>('home');
    const [childId, setChildId] = useState<string | null>(null);
    useSystemDark();

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [tab, childId]);

    const students = parent?.students || [];
    const student = students.find((s) => s.id === childId) || students[0];
    const school = parent?.school;
    const wa = whatsappNumber(school?.phone);
    // Crèches never have grades or homework: the tab only exists when any child has at least one.
    const hasGrades = students.some((s) => (s.grades || []).length > 0 || (s.homework || []).length > 0);
    const tabs = TABS.filter((x) => x.id !== 'grades' || hasGrades);
    const activeTab: Tab = tab === 'grades' && !hasGrades ? 'home' : tab;

    return (
        <div dir={dir} className="min-h-screen bg-slate-100 dark:bg-black">
            <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden bg-slate-50 dark:bg-slate-950 md:my-0 md:shadow-2xl">
                {/* Top bar */}
                <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80">
                    <div className="flex items-center gap-3 px-4 py-3">
                        {school?.logo ? (
                            <img src={school.logo} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-800" />
                        ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                                <School className="h-5 w-5" aria-hidden />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{school?.name || t.appName}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{parent ? parent.name : t.appName}</p>
                        </div>
                        {parent && !error && (
                            <button
                                type="button"
                                onClick={() => setInboxOpen(true)}
                                aria-label={t.notifications}
                                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <Bell className="h-4 w-4" />
                                {unread > 0 && (
                                    <span className="absolute -end-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-950">
                                        <Ltr>{unread > 99 ? '99+' : unread}</Ltr>
                                    </span>
                                )}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')}
                            className="h-9 shrink-0 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 active:scale-95 dark:border-slate-700 dark:text-slate-200"
                            aria-label="Langue / اللغة"
                        >
                            {t.langSwitch}
                        </button>
                        {school?.phone && (
                            <a
                                href={`tel:${school.phone}`}
                                aria-label={t.call}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 active:scale-95 dark:bg-indigo-500/15 dark:text-indigo-300"
                            >
                                <Phone className="h-4 w-4" />
                            </a>
                        )}
                        {wa && (
                            <a
                                href={`https://wa.me/${wa}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t.whatsapp}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 active:scale-95 dark:bg-emerald-500/15 dark:text-emerald-300"
                            >
                                <MessageCircle className="h-4 w-4" />
                            </a>
                        )}
                    </div>

                    {/* Child switcher */}
                    {students.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {students.map((s) => {
                                const active = s.id === student?.id;
                                return (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => setChildId(s.id)}
                                        aria-pressed={active}
                                        className={`flex shrink-0 items-center gap-2 rounded-full py-1 pe-3.5 ps-1 text-sm font-medium transition active:scale-95 ${
                                            active
                                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                                                : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800'
                                        }`}
                                    >
                                        <span
                                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                                active ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                                            }`}
                                        >
                                            {initials(s.name, s.surname)}
                                        </span>
                                        {s.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </header>

                <main className="flex-1 space-y-4 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4">
                    {error ? (
                        <Card className="mt-10 text-center">
                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                                <LinkIcon className="h-7 w-7" aria-hidden />
                            </div>
                            <p className="font-semibold text-slate-900 dark:text-white">{t.errorTitle}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.errorBody}</p>
                        </Card>
                    ) : !parent ? (
                        <div className="-mx-4 -mt-4">
                            <Skeleton />
                        </div>
                    ) : !student ? (
                        <Card>
                            <EmptyState icon={Home} title={t.noChildren} />
                        </Card>
                    ) : (
                        <>
                            <InstallBanner t={t} />
                            {activeTab === 'home' && <HomeTab token={token} parent={parent} student={student} t={t} lang={lang} goTo={setTab} />}
                            {activeTab === 'attendance' && <AttendanceTab student={student} t={t} lang={lang} />}
                            {activeTab === 'payments' && <PaymentsTab student={student} t={t} lang={lang} />}
                            {activeTab === 'grades' && (
                                <>
                                    {(student.homework || []).length > 0 && <HomeworkSection student={student} t={t} lang={lang} />}
                                    {((student.grades || []).length > 0 || (student.homework || []).length === 0) && (
                                        <GradesTab parent={parent} student={student} t={t} lang={lang} />
                                    )}
                                </>
                            )}
                            {activeTab === 'school' && <SchoolTab token={token} parent={parent} student={student} t={t} lang={lang} setActivities={setActivities} />}
                        </>
                    )}
                </main>

                {inboxOpen && parent && (
                    <NotificationsSheet
                        token={token}
                        t={t}
                        lang={lang}
                        onClose={() => setInboxOpen(false)}
                        onUnread={setUnread}
                        onOpenItem={(n: ParentNotification) => {
                            const target: Tab =
                                n.kind === 'ATTENDANCE' ? 'attendance' : n.kind === 'GRADE' || n.kind === 'HOMEWORK' ? 'grades' : n.kind === 'ACTIVITY' ? 'school' : 'home';
                            if (n.studentId && students.some((s) => s.id === n.studentId)) setChildId(n.studentId);
                            setTab(target);
                            setInboxOpen(false);
                        }}
                    />
                )}

                {/* Bottom tab bar */}
                {parent && student && !error && (
                    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-slate-200/60 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/90">
                        <ul className={tabs.length === 5 ? 'grid grid-cols-5' : 'grid grid-cols-4'}>
                            {tabs.map(({ id, icon: Icon }) => {
                                const active = activeTab === id;
                                return (
                                    <li key={id}>
                                        <button
                                            type="button"
                                            onClick={() => setTab(id)}
                                            aria-current={active ? 'page' : undefined}
                                            className={`flex w-full flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                                                active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                                            }`}
                                        >
                                            <span className={`flex h-7 w-10 items-center justify-center rounded-full transition ${active ? 'bg-indigo-100 dark:bg-indigo-500/15' : ''}`}>
                                                <Icon className="h-5 w-5" aria-hidden />
                                            </span>
                                            {t.tabs[id]}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                )}
            </div>
        </div>
    );
}
