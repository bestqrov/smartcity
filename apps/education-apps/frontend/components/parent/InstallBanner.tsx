'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import type { ParentMessages } from '@/lib/parent/messages';

const DISMISS_KEY = 'parent-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner({ t }: { t: ParentMessages }) {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
    const [ios, setIos] = useState(false);
    const [hidden, setHidden] = useState(true);

    useEffect(() => {
        let dismissed = false;
        try {
            dismissed = localStorage.getItem(DISMISS_KEY) === '1';
        } catch {
            // storage unavailable: show the banner
        }
        const standalone =
            window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
        if (dismissed || standalone) return;

        const ua = navigator.userAgent;
        const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
        const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome/i.test(ua);
        if (isIos && isSafari) {
            setIos(true);
            setHidden(false);
        }

        const onPrompt = (e: Event) => {
            e.preventDefault();
            setDeferred(e as BeforeInstallPromptEvent);
            setHidden(false);
        };
        const onInstalled = () => setHidden(true);
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const dismiss = () => {
        setHidden(true);
        try {
            localStorage.setItem(DISMISS_KEY, '1');
        } catch {
            // ignore
        }
    };

    const install = async () => {
        if (!deferred) return;
        await deferred.prompt();
        const choice = await deferred.userChoice.catch(() => null);
        setDeferred(null);
        if (choice?.outcome === 'accepted') setHidden(true);
    };

    if (hidden || (!ios && !deferred)) return null;

    return (
        <div className="flex items-start gap-3 rounded-3xl border border-indigo-100 bg-indigo-50 p-3.5 dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <img src="/icon.jpg" alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.install.title}</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {ios ? (
                        <span className="inline-flex flex-wrap items-center gap-1">
                            <Share className="h-3.5 w-3.5" aria-hidden />
                            {t.install.iosHint}
                        </span>
                    ) : (
                        t.install.body
                    )}
                </p>
                {!ios && deferred && (
                    <button
                        type="button"
                        onClick={install}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white active:scale-95"
                    >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        {t.install.button}
                    </button>
                )}
            </div>
            <button type="button" onClick={dismiss} aria-label={t.install.dismiss} className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-white/60 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}
