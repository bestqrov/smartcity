'use client';

// «Messages aux écoles»: the super admin writes one message, picks the channels and the schools by filters, sees
// the recipient count, confirms, then follows the sending in the history (per school, with «Relancer les échecs»).
import { useCallback, useEffect, useState } from 'react';
import { DashboardBanner } from '@/components/dashboard/DashboardShell';
import { usePlatformPrefs } from '@/lib/platform/prefs';
import { fmtDay } from '@/lib/agent/format';
import type { AgentLang } from '@/lib/agent/messages';
import type { PlatformMessages } from '@/lib/platform/messages';
import { INSTITUTION_TYPES, type InstitutionType } from '@/lib/institutionTypes';
import { apiErrorMessage, getAllPacks, type AdminPack } from '@/lib/services/packs';
import { getSalesAgents, type SalesAgentListItem } from '@/lib/services/salesAgents';
import {
    BROADCAST_CHANNELS,
    SCHOOL_STATES,
    createBroadcast,
    getBroadcast,
    getBroadcasts,
    pendingCount,
    previewBroadcast,
    retryBroadcast,
    type Broadcast,
    type BroadcastChannel,
    type BroadcastDetail,
    type BroadcastFilters,
    type BroadcastMessageStatus,
    type BroadcastPreview,
    type SchoolState,
} from '@/lib/services/broadcasts';

const cardClass = 'space-y-4 rounded-2xl border border-espresso-100 bg-white p-5 shadow-sm dark:border-espresso-800 dark:bg-espresso-900';
const titleClass = 'text-base font-extrabold text-espresso-800 dark:text-espresso-50';
const labelClass = 'block text-sm font-semibold text-gray-700 dark:text-espresso-100';
const inputClass =
    'mt-1 w-full rounded-xl border border-espresso-100 bg-white px-3 py-2 text-sm text-gray-900 focus:border-espresso-500 focus:outline-none focus:ring-2 focus:ring-espresso-500/30 dark:border-espresso-700 dark:bg-espresso-950 dark:text-espresso-50';
const hintClass = 'text-xs text-gray-500 dark:text-espresso-300';
const primaryBtn = 'rounded-full bg-espresso-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-espresso-700 disabled:opacity-50 dark:bg-espresso-600';
const secondaryBtn =
    'rounded-full border border-espresso-200 px-5 py-2 text-sm font-semibold text-espresso-800 hover:bg-espresso-50 disabled:opacity-50 dark:border-espresso-700 dark:text-espresso-100 dark:hover:bg-espresso-800';
const STATUS_TONES: Record<BroadcastMessageStatus, string> = {
    PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    SENDING: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    SENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
    SKIPPED: 'bg-gray-200 text-gray-700 dark:bg-espresso-800 dark:text-espresso-200',
};

export default function BroadcastsPage() {
    const { m, lang } = usePlatformPrefs();
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [channels, setChannels] = useState<BroadcastChannel[]>([]);
    const [states, setStates] = useState<SchoolState[]>([]);
    const [packId, setPackId] = useState('');
    const [institutionType, setInstitutionType] = useState<InstitutionType | ''>('');
    const [salesAgentId, setSalesAgentId] = useState('');
    const [packs, setPacks] = useState<AdminPack[]>([]);
    const [agents, setAgents] = useState<SalesAgentListItem[]>([]);
    const [preview, setPreview] = useState<BroadcastPreview | null>(null);
    const [counting, setCounting] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [history, setHistory] = useState<Broadcast[] | null>(null);

    useEffect(() => {
        getAllPacks().then(setPacks).catch(() => {});
        getSalesAgents().then(setAgents).catch(() => {});
    }, []);

    const filters: BroadcastFilters = {
        ...(states.length ? { states } : {}),
        ...(packId ? { packId } : {}),
        ...(institutionType ? { institutionType } : {}),
        ...(salesAgentId ? { salesAgentId } : {}),
    };
    const filtersKey = JSON.stringify(filters);

    // Recount the recipients whenever the filters change.
    useEffect(() => {
        let alive = true;
        setCounting(true);
        setConfirming(false);
        previewBroadcast(JSON.parse(filtersKey))
            .then((p) => {
                if (!alive) return;
                setPreview(p);
                // Drop a channel that became unavailable; pre-select the available ones on first load.
                setChannels((prev) => {
                    const ok = (c: BroadcastChannel) => (c === 'EMAIL' ? p.channels.email : p.channels.whatsapp);
                    return prev.length ? prev.filter(ok) : BROADCAST_CHANNELS.filter(ok);
                });
            })
            .catch((err) => alive && setError(apiErrorMessage(err)))
            .finally(() => alive && setCounting(false));
        return () => {
            alive = false;
        };
    }, [filtersKey]);

    const loadHistory = useCallback(() => {
        getBroadcasts()
            .then(setHistory)
            .catch((err) => {
                setHistory([]);
                setError(apiErrorMessage(err));
            });
    }, []);
    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // While a broadcast is still sending, refresh the history every 5 s.
    const busy = (history ?? []).some((b) => pendingCount(b) > 0);
    useEffect(() => {
        if (!busy) return;
        const timer = window.setInterval(loadHistory, 5000);
        return () => window.clearInterval(timer);
    }, [busy, loadHistory]);

    const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
    const available = (c: BroadcastChannel) => (c === 'EMAIL' ? !!preview?.channels.email : !!preview?.channels.whatsapp);

    const askConfirm = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNotice('');
        if (!subject.trim() || !body.trim()) return setError(m.bc_err_subject);
        if (!channels.some(available)) return setError(m.bc_err_channel);
        if (!preview?.schools) return setError(m.bc_err_none);
        setConfirming(true);
    };

    const send = async () => {
        setSending(true);
        setError('');
        try {
            await createBroadcast({ subject: subject.trim(), body: body.trim(), channels: channels.filter(available), filters });
            setNotice(m.bc_queued);
            setSubject('');
            setBody('');
            setConfirming(false);
            loadHistory();
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-4">
            <DashboardBanner title={m.bc_title} subtitle={m.bc_sub} />

            <form onSubmit={askConfirm} className={cardClass} aria-labelledby="bc-compose">
                <h2 id="bc-compose" className={titleClass}>{m.bc_compose}</h2>
                <label className={labelClass}>
                    {m.bc_subject}
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className={inputClass} />
                </label>
                <label className={labelClass}>
                    {m.bc_body}
                    <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={6} className={inputClass} />
                </label>
                <p className={hintClass} dir="auto">{m.bc_placeholders}</p>

                <fieldset>
                    <legend className={labelClass}>{m.bc_channels}</legend>
                    <div className="mt-2 flex flex-wrap gap-4">
                        {BROADCAST_CHANNELS.map((c) => (
                            <label key={c} className={`flex items-center gap-2 text-sm ${available(c) ? 'text-gray-800 dark:text-espresso-50' : 'text-gray-400 dark:text-espresso-500'}`}>
                                <input type="checkbox" className="h-4 w-4" disabled={!available(c)} checked={channels.includes(c) && available(c)} onChange={() => setChannels(toggle(channels, c))} />
                                {m.bc_channel[c]}
                            </label>
                        ))}
                    </div>
                    {preview && !preview.channels.email && <p className={`mt-1 ${hintClass}`}>{m.bc_email_off}</p>}
                    {preview && !preview.channels.whatsapp && <p className={`mt-1 ${hintClass}`}>{m.bc_wa_off}</p>}
                </fieldset>

                <fieldset className="space-y-3">
                    <legend className={labelClass}>{m.bc_filters}</legend>
                    <div className="flex flex-wrap gap-2">
                        {SCHOOL_STATES.map((s) => (
                            <button
                                key={s}
                                type="button"
                                aria-pressed={states.includes(s)}
                                onClick={() => setStates(toggle(states, s))}
                                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                                    states.includes(s)
                                        ? 'border-espresso-700 bg-espresso-800 text-white dark:bg-espresso-200 dark:text-espresso-950'
                                        : 'border-espresso-200 bg-white text-espresso-800 dark:border-espresso-700 dark:bg-espresso-900 dark:text-espresso-100'
                                }`}
                            >
                                {m.bc_states[s]}
                            </button>
                        ))}
                        {states.length === 0 && <span className={`self-center ${hintClass}`}>{m.bc_all_states}</span>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <select aria-label={m.bc_any_pack} value={packId} onChange={(e) => setPackId(e.target.value)} className={inputClass}>
                            <option value="">{m.bc_any_pack}</option>
                            {packs.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <select aria-label={m.bc_any_type} value={institutionType} onChange={(e) => setInstitutionType(e.target.value as InstitutionType | '')} className={inputClass}>
                            <option value="">{m.bc_any_type}</option>
                            {INSTITUTION_TYPES.map((t) => (
                                <option key={t} value={t}>{m.institution_type[t]}</option>
                            ))}
                        </select>
                        <select aria-label={m.bc_any_agent} value={salesAgentId} onChange={(e) => setSalesAgentId(e.target.value)} className={inputClass}>
                            <option value="">{m.bc_any_agent}</option>
                            {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                    <p role="status" className="text-sm font-semibold text-espresso-700 dark:text-espresso-200">
                        {counting || !preview ? m.bc_counting : m.bc_count(preview.schools, preview.email, preview.whatsapp)}
                    </p>
                </fieldset>

                {error && (
                    <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200">
                        {error}
                    </div>
                )}
                {notice && (
                    <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-200">
                        {notice}
                    </div>
                )}

                {confirming && preview ? (
                    <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
                        <span className="text-sm font-bold text-amber-900 dark:text-amber-100">{m.bc_confirm(preview.schools)}</span>
                        <button type="button" onClick={() => setConfirming(false)} disabled={sending} className={secondaryBtn}>{m.bc_cancel}</button>
                        <button type="button" onClick={send} disabled={sending} className={primaryBtn}>{sending ? m.bc_sending : m.bc_confirm_yes}</button>
                    </div>
                ) : (
                    <div className="flex justify-end">
                        <button type="submit" disabled={counting} className={primaryBtn}>{m.bc_send}</button>
                    </div>
                )}
            </form>

            <section className={cardClass} aria-labelledby="bc-history">
                <h2 id="bc-history" className={titleClass}>{m.bc_history}</h2>
                {history === null ? (
                    <p role="status" className={hintClass}>{m.rq_loading}</p>
                ) : history.length === 0 ? (
                    <p className="text-sm text-espresso-600 dark:text-espresso-300">{m.bc_empty}</p>
                ) : (
                    <ul className="divide-y divide-espresso-100 dark:divide-espresso-800">
                        {history.map((b) => (
                            <HistoryItem key={b.id} item={b} m={m} lang={lang} onChanged={loadHistory} />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function HistoryItem({ item, m, lang, onChanged }: { item: Broadcast; m: PlatformMessages; lang: AgentLang; onChanged: () => void }) {
    const [detail, setDetail] = useState<BroadcastDetail | null>(null);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const failed = item.emailFailed + item.whatsappFailed;
    const pending = pendingCount(item);

    const loadDetail = useCallback(() => {
        getBroadcast(item.id).then(setDetail).catch((err) => setNote(apiErrorMessage(err)));
    }, [item.id]);

    // Keep the open detail in step with the list refreshes.
    useEffect(() => {
        if (open) loadDetail();
    }, [open, loadDetail, item]);

    const retry = async () => {
        setBusy(true);
        setNote('');
        try {
            const r = await retryBroadcast(item.id);
            setNote(m.bc_retried(r.requeued));
            onChanged();
        } catch (err) {
            setNote(apiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const line = (c: BroadcastChannel) =>
        c === 'EMAIL'
            ? m.bc_progress(item.emailSent, item.emailFailed, item.emailSkipped)
            : m.bc_progress(item.whatsappSent, item.whatsappFailed, item.whatsappSkipped);

    return (
        <li className="space-y-2 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="font-bold text-gray-900 dark:text-espresso-50" dir="auto">{item.subject}</div>
                    <div className="text-xs text-gray-500 dark:text-espresso-300">
                        <span className="tabular-nums">{fmtDay(item.createdAt, lang)}</span> · {item.total} {m.bc_school.toLowerCase()}
                        {pending > 0 && <span className="ms-2 font-semibold text-amber-700 dark:text-amber-300">{m.bc_in_progress(pending)}</span>}
                    </div>
                    {item.channels.map((c) => (
                        <div key={c} className="text-sm text-gray-700 dark:text-espresso-100">
                            <span className="font-semibold">{m.bc_channel[c]}</span> : {line(c)}
                        </div>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2">
                    {failed > 0 && (
                        <button type="button" onClick={retry} disabled={busy} className={secondaryBtn}>{m.bc_retry}</button>
                    )}
                    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={secondaryBtn}>
                        {open ? m.bc_hide : m.bc_details}
                    </button>
                </div>
            </div>
            {note && <p role="status" className="text-sm text-espresso-700 dark:text-espresso-200">{note}</p>}
            {open && detail && (
                <div className="overflow-x-auto">
                    <table className="w-full text-start text-sm">
                        <thead className="text-xs uppercase text-gray-500 dark:text-espresso-300">
                            <tr>
                                <th className="px-2 py-1 text-start">{m.bc_school}</th>
                                <th className="px-2 py-1 text-start">{m.bc_channels}</th>
                                <th className="px-2 py-1 text-start">{m.bc_to}</th>
                                <th className="px-2 py-1 text-start">{m.rq_status}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detail.messages.map((msg) => (
                                <tr key={msg.id} className="border-t border-espresso-100 dark:border-espresso-800">
                                    <td className="px-2 py-1.5 text-gray-800 dark:text-espresso-50">{msg.schoolName}</td>
                                    <td className="px-2 py-1.5">{m.bc_channel[msg.channel]}</td>
                                    <td className="px-2 py-1.5 break-all text-gray-600 dark:text-espresso-200" dir="ltr">{msg.to || '—'}</td>
                                    <td className="px-2 py-1.5">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONES[msg.status]}`}>{m.bc_msg_status[msg.status]}</span>
                                        {msg.error && <div className="mt-0.5 text-xs text-gray-500 dark:text-espresso-300">{msg.error}</div>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </li>
    );
}
