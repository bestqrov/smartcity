'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, Bell, Loader2, LogOut, MessageCircle, RefreshCw, Send, Smartphone } from 'lucide-react';
import api from '@/lib/api';

type WaStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';
interface StatusDto {
    configured: boolean;
    status: WaStatus;
    phone: string | null;
    sendAttendance: boolean;
    sendGrades: boolean;
    sendAnnouncements: boolean;
    sendActivities: boolean;
    sendHomework: boolean;
}
interface ConnectDto extends StatusDto {
    qr?: { base64: string | null; code: string | null } | null;
}
interface MessageRow {
    id: string;
    channel: 'PUSH' | 'WHATSAPP';
    kind: 'ATTENDANCE' | 'GRADE' | 'ANNOUNCEMENT' | 'ACTIVITY' | 'HOMEWORK';
    to: string | null;
    title: string;
    body: string;
    status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
    error: string | null;
    attempts: number;
    createdAt: string;
    sentAt: string | null;
}

const KIND_LABEL: Record<MessageRow['kind'], string> = { ATTENDANCE: 'Absence', GRADE: 'Notes', ANNOUNCEMENT: 'Annonce', ACTIVITY: 'Activité', HOMEWORK: 'Devoirs' };
const STATUS_META: Record<MessageRow['status'], { label: string; cls: string }> = {
    PENDING: { label: 'En attente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
    SENT: { label: 'Envoyé', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
    FAILED: { label: 'Échec', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
    SKIPPED: { label: 'Ignoré', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};
const TOGGLES: { key: 'sendAttendance' | 'sendGrades' | 'sendAnnouncements' | 'sendActivities' | 'sendHomework'; label: string }[] = [
    { key: 'sendAttendance', label: 'Absences et retards' },
    { key: 'sendGrades', label: 'Publication des notes' },
    { key: 'sendAnnouncements', label: 'Annonces' },
    { key: 'sendActivities', label: 'Activités et sorties' },
    { key: 'sendHomework', label: 'Devoirs' },
];

const errMsg = (e: any) => e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Erreur';
const POLL_MS = 3000;
const POLL_MAX_MS = 2 * 60 * 1000;

export default function WhatsappAutoCard() {
    const [st, setSt] = useState<StatusDto | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [qr, setQr] = useState<string | null>(null);
    const [qrExpired, setQrExpired] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testPhone, setTestPhone] = useState('');
    const [testMsg, setTestMsg] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [msgLoading, setMsgLoading] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollStart = useRef(0);

    const stopPolling = useCallback(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
    }, []);

    const loadStatus = useCallback(async () => {
        try {
            const r = await api.get('/whatsapp/status');
            setSt(r.data.data);
            setLoadError(null);
            return r.data.data as StatusDto;
        } catch (e) {
            setLoadError(errMsg(e));
            return null;
        }
    }, []);

    const loadMessages = useCallback(async () => {
        setMsgLoading(true);
        try {
            const r = await api.get('/whatsapp/messages');
            setMessages(r.data.data || []);
        } catch {
            /* non-blocking */
        } finally {
            setMsgLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStatus();
        loadMessages();
        return stopPolling;
    }, [loadStatus, loadMessages, stopPolling]);

    const startPolling = () => {
        stopPolling();
        pollStart.current = Date.now();
        setQrExpired(false);
        pollRef.current = setInterval(async () => {
            if (Date.now() - pollStart.current > POLL_MAX_MS) {
                stopPolling();
                setQrExpired(true);
                return;
            }
            const s = await loadStatus();
            if (s?.status === 'CONNECTED') {
                stopPolling();
                setQr(null);
            }
        }, POLL_MS);
    };

    const connect = async () => {
        setBusy(true);
        setError(null);
        try {
            const r = await api.post('/whatsapp/connect');
            const d: ConnectDto = r.data.data;
            setSt(d);
            if (d.status === 'CONNECTED') return;
            let src: string | null = null;
            if (d.qr?.base64) src = d.qr.base64.startsWith('data:') ? d.qr.base64 : `data:image/png;base64,${d.qr.base64}`;
            else if (d.qr?.code) src = await QRCode.toDataURL(d.qr.code, { width: 260, margin: 1 });
            setQr(src);
            startPolling();
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    const updateSetting = async (key: (typeof TOGGLES)[number]['key'], value: boolean) => {
        if (!st) return;
        const prev = st;
        setSt({ ...st, [key]: value });
        try {
            const r = await api.put('/whatsapp/settings', { [key]: value });
            setSt(r.data.data);
        } catch (e) {
            setSt(prev);
            setError(errMsg(e));
        }
    };

    const sendTest = async () => {
        if (!testPhone.trim()) return;
        setBusy(true);
        setTestMsg(null);
        setError(null);
        try {
            const r = await api.post('/whatsapp/test', { phone: testPhone.trim() });
            setTestMsg(`Message test envoyé à ${r.data.data?.to || testPhone}`);
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    const disconnect = async () => {
        if (!window.confirm('Déconnecter WhatsApp ? Les envois automatiques par WhatsApp seront arrêtés.')) return;
        setBusy(true);
        setError(null);
        try {
            const r = await api.post('/whatsapp/disconnect');
            setSt(r.data.data);
            setQr(null);
            stopPolling();
        } catch (e) {
            setError(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    const shell = 'mt-8 rounded-2xl border p-5 sm:p-6';

    if (!st) {
        return (
            <div className={`${shell} border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
                {loadError ? (
                    <p className="text-sm text-rose-600">{loadError}</p>
                ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden />
                )}
            </div>
        );
    }

    if (!st.configured) {
        return (
            <div className={`${shell} border-gray-200 bg-gray-50 text-gray-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400`}>
                <div className="flex items-center gap-2 font-semibold">
                    <MessageCircle className="h-5 w-5" aria-hidden />
                    WhatsApp automatique non disponible
                </div>
                <p className="mt-1 text-sm">Ce service n'est pas activé sur ce serveur. Les parents restent notifiés par l'application.</p>
            </div>
        );
    }

    return (
        <div className={`${shell} border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 dark:text-white">
                    <MessageCircle className="h-5 w-5 text-emerald-500" aria-hidden />
                    WhatsApp automatique
                </h3>
                <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        st.status === 'CONNECTED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : st.status === 'CONNECTING'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                >
                    {st.status === 'CONNECTED' ? 'Connecté' : st.status === 'CONNECTING' ? 'Connexion…' : 'Déconnecté'}
                </span>
            </div>

            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

            {st.status !== 'CONNECTED' ? (
                <div className="mt-3 space-y-3">
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                        Envoyez automatiquement les absences, les notes et les annonces aux parents sur WhatsApp, depuis le numéro de votre établissement.
                    </p>
                    <p dir="rtl" className="text-sm text-gray-500 dark:text-slate-400">
                        صيفطو الغياب والنقط والإعلانات للوالدين فالواتساب أوتوماتيكيا من رقم المؤسسة.
                    </p>
                    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        Le numéro de l'établissement est utilisé ; les envois sont espacés de quelques secondes.
                    </p>

                    {qr && !qrExpired && (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 p-4 dark:border-slate-600">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qr} alt="QR code WhatsApp" className="h-56 w-56 max-w-full rounded-lg bg-white p-2" />
                            <p className="flex items-center gap-1.5 text-center text-xs text-gray-500 dark:text-slate-400">
                                <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
                                WhatsApp → Appareils connectés → Connecter un appareil, puis scannez ce code.
                            </p>
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden />
                        </div>
                    )}

                    {qrExpired ? (
                        <button
                            type="button"
                            onClick={connect}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                            <RefreshCw className="h-4 w-4" aria-hidden />
                            Réessayer
                        </button>
                    ) : (
                        !qr && (
                            <button
                                type="button"
                                onClick={connect}
                                disabled={busy}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MessageCircle className="h-4 w-4" aria-hidden />}
                                Connecter WhatsApp
                            </button>
                        )
                    )}
                </div>
            ) : (
                <div className="mt-3 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                        Numéro connecté : <bdi dir="ltr" className="font-semibold text-gray-900 dark:text-white">{st.phone || '—'}</bdi>
                    </p>
                    <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-slate-800 dark:border-slate-800">
                        {TOGGLES.map((tg) => (
                            <label key={tg.key} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-slate-200">
                                {tg.label}
                                <input
                                    type="checkbox"
                                    className="h-5 w-5 accent-emerald-600"
                                    checked={st[tg.key]}
                                    onChange={(e) => updateSetting(tg.key, e.target.checked)}
                                />
                            </label>
                        ))}
                    </div>
                    <div>
                        <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-slate-200">Envoyer un message test</p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                type="tel"
                                dir="ltr"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                placeholder="06XXXXXXXX"
                                className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={sendTest}
                                disabled={busy || !testPhone.trim()}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                <Send className="h-4 w-4" aria-hidden />
                                Envoyer
                            </button>
                        </div>
                        {testMsg && <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">{testMsg}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={disconnect}
                        disabled={busy}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    >
                        <LogOut className="h-4 w-4" aria-hidden />
                        Déconnecter
                    </button>
                </div>
            )}

            <div className="mt-6">
                <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-white">Derniers envois</h4>
                    <button
                        type="button"
                        onClick={loadMessages}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400"
                        aria-label="Actualiser"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${msgLoading ? 'animate-spin' : ''}`} aria-hidden />
                        Actualiser
                    </button>
                </div>
                {messages.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucun envoi pour le moment.</p>
                ) : (
                    <ul className="max-h-96 space-y-2 overflow-y-auto">
                        {messages.map((m) => (
                            <li
                                key={m.id}
                                className="flex items-start gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-slate-800/60"
                                title={m.error || undefined}
                            >
                                {m.channel === 'WHATSAPP' ? (
                                    <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="WhatsApp" />
                                ) : (
                                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-label="Push" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-800 dark:text-slate-100">
                                        {KIND_LABEL[m.kind]} · {m.title}
                                    </p>
                                    <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                                        {m.to && <bdi dir="ltr">{m.to}</bdi>}
                                        {m.to && ' · '}
                                        {new Date(m.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </p>
                                    {m.status === 'FAILED' && m.error && <p className="truncate text-xs text-rose-500">{m.error}</p>}
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_META[m.status].cls}`}>
                                    {STATUS_META[m.status].label}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
