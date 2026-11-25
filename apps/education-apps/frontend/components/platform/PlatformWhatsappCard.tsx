'use client';

// «WhatsApp plateforme»: the super admin links the number that sends the broadcasts, by QR code (same flow as schools).
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { PlatformMessages } from '@/lib/platform/messages';
import { apiErrorMessage } from '@/lib/services/packs';
import {
    connectPlatformWhatsapp,
    disconnectPlatformWhatsapp,
    getPlatformWhatsapp,
    type PlatformWhatsapp,
} from '@/lib/services/broadcasts';

const POLL_MS = 3000;
const POLL_MAX_MS = 2 * 60 * 1000;

export default function PlatformWhatsappCard({ m, className }: { m: PlatformMessages; className: string }) {
    const [st, setSt] = useState<PlatformWhatsapp | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [expired, setExpired] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
    }, []);

    useEffect(() => {
        getPlatformWhatsapp().then(setSt).catch((err) => setError(apiErrorMessage(err)));
        return stopPolling;
    }, [stopPolling]);

    const startPolling = () => {
        stopPolling();
        const start = Date.now();
        setExpired(false);
        pollRef.current = setInterval(async () => {
            if (Date.now() - start > POLL_MAX_MS) {
                stopPolling();
                setQr(null);
                setExpired(true);
                return;
            }
            try {
                const s = await getPlatformWhatsapp();
                setSt(s);
                if (s.status === 'CONNECTED') {
                    stopPolling();
                    setQr(null);
                }
            } catch {
                /* keep polling */
            }
        }, POLL_MS);
    };

    const connect = async () => {
        setBusy(true);
        setError('');
        try {
            const d = await connectPlatformWhatsapp();
            setSt(d);
            if (d.status === 'CONNECTED') return;
            let src: string | null = null;
            if (d.qr.base64) src = d.qr.base64.startsWith('data:') ? d.qr.base64 : `data:image/png;base64,${d.qr.base64}`;
            else if (d.qr.code) src = await QRCode.toDataURL(d.qr.code, { width: 260, margin: 1 });
            setQr(src);
            startPolling();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const disconnect = async () => {
        setBusy(true);
        setError('');
        stopPolling();
        setQr(null);
        try {
            setSt(await disconnectPlatformWhatsapp());
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const status = st?.status ?? 'DISCONNECTED';
    const tone =
        status === 'CONNECTED'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
            : status === 'CONNECTING'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
              : 'bg-gray-200 text-gray-700 dark:bg-espresso-800 dark:text-espresso-200';
    const label = status === 'CONNECTED' ? m.pw_connected : status === 'CONNECTING' ? m.pw_connecting : m.pw_disconnected;
    const btn = 'rounded-full px-5 py-2 text-sm font-bold disabled:opacity-50';

    return (
        <section className={className} aria-labelledby="ps-whatsapp">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="ps-whatsapp" className="text-base font-extrabold text-espresso-800 dark:text-espresso-50">{m.pw_card}</h2>
                {st && <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label}</span>}
            </div>
            <p className="text-xs text-gray-500 dark:text-espresso-300">{m.pw_hint}</p>
            {st && !st.configured ? (
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{m.pw_not_configured}</p>
            ) : st ? (
                <>
                    {st.phone && (
                        <p className="text-sm font-semibold text-gray-800 dark:text-espresso-50" dir="ltr">+{st.phone}</p>
                    )}
                    {qr && <img src={qr} alt="QR WhatsApp" width={220} height={220} className="rounded-xl border border-espresso-100 bg-white p-2" />}
                    {expired && <p className="text-sm text-amber-700 dark:text-amber-300">{m.pw_qr_expired}</p>}
                    <div className="flex flex-wrap gap-2">
                        {status !== 'CONNECTED' && (
                            <button type="button" onClick={connect} disabled={busy} className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}>
                                {m.pw_connect}
                            </button>
                        )}
                        {status !== 'DISCONNECTED' && (
                            <button type="button" onClick={disconnect} disabled={busy} className={`${btn} border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30`}>
                                {m.pw_disconnect}
                            </button>
                        )}
                    </div>
                </>
            ) : null}
            {error && <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
        </section>
    );
}
