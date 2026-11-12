'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { getPublicKey, getSubscription, isIOS, isPushSupported, isStandalone, subscribe, unsubscribe } from '@/lib/parent/push';
import { Card } from './ui';

interface Props {
    token: string;
    t: ParentMessages;
    lang: ParentLang;
}

/** Notifications on/off switch on the school tab. */
export function PushToggleRow({ token, t, lang }: Props) {
    const [available, setAvailable] = useState(false);
    const [on, setOn] = useState(false);
    const [busy, setBusy] = useState(false);
    const [denied, setDenied] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!isPushSupported() || (isIOS() && !isStandalone())) return;
        (async () => {
            const key = await getPublicKey();
            if (!alive || !key) return;
            setAvailable(true);
            setDenied(Notification.permission === 'denied');
            const sub = await getSubscription(token).catch(() => null);
            if (alive) setOn(!!sub);
        })();
        return () => {
            alive = false;
        };
    }, [token]);

    if (!available) return null;

    const toggle = async () => {
        setBusy(true);
        try {
            if (on) {
                await unsubscribe(token);
                setOn(false);
            } else {
                const ok = await subscribe(token, lang);
                setOn(ok);
                setDenied(Notification.permission === 'denied');
            }
        } catch {
            /* keep previous state */
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card className="flex items-center gap-3">
            <Bell className="h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.pushRow}</p>
                {denied && <p className="text-xs text-slate-400">{t.pushDenied}</p>}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={t.pushRow}
                onClick={toggle}
                disabled={busy || (denied && !on)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
                <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'start-[1.375rem]' : 'start-0.5'}`}
                />
            </button>
        </Card>
    );
}
