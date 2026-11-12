'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing, CheckCircle2 } from 'lucide-react';
import type { ParentLang, ParentMessages } from '@/lib/parent/messages';
import { getPublicKey, isIOS, isPushSupported, isStandalone, subscribe } from '@/lib/parent/push';
import { Card } from './ui';

interface Props {
    token: string;
    t: ParentMessages;
    lang: ParentLang;
}

/** "Enable notifications" card on the home tab; hidden when not applicable. */
export function PushPrompt({ token, t, lang }: Props) {
    const [state, setState] = useState<'hidden' | 'ask' | 'busy' | 'done'>('hidden');

    useEffect(() => {
        let alive = true;
        if (!isPushSupported() || Notification.permission !== 'default') return;
        if (isIOS() && !isStandalone()) return; // InstallBanner explains this case
        getPublicKey().then((k) => alive && k && setState('ask'));
        return () => {
            alive = false;
        };
    }, []);

    if (state === 'hidden') return null;

    if (state === 'done')
        return (
            <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                {t.pushEnabled}
            </div>
        );

    const enable = async () => {
        setState('busy');
        try {
            const ok = await subscribe(token, lang);
            setState(ok ? 'done' : 'hidden');
        } catch {
            setState('ask');
        }
    };

    return (
        <Card className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <BellRing className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.pushTitle}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t.pushHint}</p>
            </div>
            <button
                type="button"
                onClick={enable}
                disabled={state === 'busy'}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white active:scale-95 disabled:opacity-60"
            >
                <Bell className="h-3.5 w-3.5" aria-hidden />
                {t.pushEnable}
            </button>
        </Card>
    );
}
