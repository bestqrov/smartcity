'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, CalendarCheck2, CheckCheck, GraduationCap, Loader2, Megaphone, PartyPopper, X, type LucideIcon } from 'lucide-react';
import type { ParentNotification, ParentNotificationKind } from '@/types';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { getParentNotifications, markParentNotificationsRead } from '@/lib/services/parents';
import { EmptyState, Ltr } from './ui';

const KIND: Record<ParentNotificationKind, { icon: LucideIcon; cls: string }> = {
    ATTENDANCE: { icon: CalendarCheck2, cls: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
    GRADE: { icon: GraduationCap, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
    ANNOUNCEMENT: { icon: Megaphone, cls: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' },
    ACTIVITY: { icon: PartyPopper, cls: 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400' },
    HOMEWORK: { icon: BookOpen, cls: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400' },
};

const PAGE = 20;

function relative(iso: string, t: ParentMessages, lang: ParentLang) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const min = Math.floor(diff / 60000);
    if (min < 1) return t.justNow;
    if (min < 60) return t.minutesAgo(min);
    const h = Math.floor(min / 60);
    if (h < 24) return t.hoursAgo(h);
    const d = Math.floor(h / 24);
    if (d < 7) return t.daysAgo(d);
    return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { numberingSystem: 'latn', day: 'numeric', month: 'short' } as Intl.DateTimeFormatOptions);
}

interface Props {
    token: string;
    t: ParentMessages;
    lang: ParentLang;
    onClose: () => void;
    onUnread: (n: number) => void;
    onOpenItem: (n: ParentNotification) => void;
}

export default function NotificationsSheet({ token, t, lang, onClose, onUnread, onOpenItem }: Props) {
    const [items, setItems] = useState<ParentNotification[]>([]);
    const [next, setNext] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    // Items already sent as read: the highlight stays for this opening so the parent sees what was new.
    const sent = useRef(new Set<string>());

    const markVisible = useCallback(
        async (list: ParentNotification[]) => {
            const ids = list.filter((n) => !n.read && !sent.current.has(n.id)).map((n) => n.id);
            if (!ids.length) return;
            ids.forEach((id) => sent.current.add(id));
            try {
                onUnread((await markParentNotificationsRead(token, ids)).unread);
            } catch {
                ids.forEach((id) => sent.current.delete(id));
            }
        },
        [token, onUnread],
    );

    const load = useCallback(
        async (before?: string) => {
            setLoading(true);
            setError(false);
            try {
                const page = await getParentNotifications(token, { before, limit: PAGE });
                setItems((prev) => (before ? [...prev, ...page.items.filter((n) => !prev.some((p) => p.id === n.id))] : page.items));
                setNext(page.nextBefore);
                onUnread(page.unread);
                markVisible(page.items);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        },
        [token, onUnread, markVisible],
    );

    useEffect(() => {
        load();
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const markAll = async () => {
        try {
            onUnread((await markParentNotificationsRead(token)).unread);
            setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch {
            setError(true);
        }
    };

    return (
        <div className="fixed inset-0 z-40 flex justify-center bg-slate-900/40" role="dialog" aria-modal="true" aria-label={t.notifications}>
            <div className="flex h-full w-full max-w-md flex-col bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2 border-b border-slate-200/60 bg-white/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] dark:border-slate-800/60 dark:bg-slate-950/90">
                    <h2 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 dark:text-white">{t.notifications}</h2>
                    <button
                        type="button"
                        onClick={markAll}
                        className="flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-indigo-600 active:scale-95 dark:text-indigo-400"
                    >
                        <CheckCheck className="h-4 w-4" aria-hidden /> {t.markAllRead}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t.close}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
                    {items.length === 0 && !loading && !error && <EmptyState icon={CheckCheck} title={t.noNotifications} />}
                    <ul className="space-y-2">
                        {items.map((n) => {
                            const meta = KIND[n.kind] ?? KIND.ANNOUNCEMENT;
                            const Icon = meta.icon;
                            return (
                                <li key={n.id}>
                                    <button
                                        type="button"
                                        onClick={() => onOpenItem(n)}
                                        className={`flex w-full items-start gap-3 rounded-2xl p-3 text-start transition active:scale-[0.99] ${
                                            n.read
                                                ? 'bg-white dark:bg-slate-900'
                                                : 'bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-500/30'
                                        }`}
                                    >
                                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.cls}`}>
                                            <Icon className="h-5 w-5" aria-hidden />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-start justify-between gap-2">
                                                <span className="min-w-0 text-sm font-semibold text-slate-900 dark:text-white">{n.title[lang] || n.title.fr}</span>
                                                <span className="shrink-0 text-[11px] text-slate-400">
                                                    <Ltr>{relative(n.createdAt, t, lang)}</Ltr>
                                                </span>
                                            </span>
                                            <span className="mt-0.5 line-clamp-3 block text-sm text-slate-600 dark:text-slate-300">{n.body[lang] || n.body.fr}</span>
                                        </span>
                                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-hidden />}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {error && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-center text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{t.loadError}</p>}
                    {loading ? (
                        <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-slate-400" />
                    ) : (
                        next && (
                            <button
                                type="button"
                                onClick={() => load(next)}
                                className="mt-4 w-full rounded-2xl bg-white py-3 text-sm font-semibold text-indigo-600 ring-1 ring-slate-200 active:scale-[0.99] dark:bg-slate-900 dark:text-indigo-400 dark:ring-slate-800"
                            >
                                {t.seeMore}
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
