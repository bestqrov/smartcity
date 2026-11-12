'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, QrCode, MessageCircle, Users, Link2Off, EyeOff, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { getParentsAccess, issueParentLinks, regenerateParentToken, type ParentAccessRow } from '@/lib/services/parents';
import { apiErrorMessage } from '@/lib/services/packs';
import { publicUrl, whatsappNumber, parentPortalMessage } from '@/lib/publicUrl';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import QrCardsPrint, { type QrCardData } from './QrCardsPrint';

type Filter = 'all' | 'nolink' | 'unopened';

const neverOpened = (p: ParentAccessRow) =>
    !!p.linkIssuedAt && (!p.lastVisitAt || new Date(p.lastVisitAt) < new Date(p.linkIssuedAt));

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');

const childrenLabel = (p: ParentAccessRow) => p.children.map((c) => `${c.name} ${c.surname}`.trim()).join(', ');

function Status({ p }: { p: ParentAccessRow }) {
    if (!p.linkIssuedAt)
        return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Sans lien</span>;
    if (neverOpened(p))
        return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">Jamais ouvert</span>;
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Ouvert</span>;
}

export default function ParentAccessManager() {
    const { profile } = useSchoolProfile();
    const [rows, setRows] = useState<ParentAccessRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
    const [filter, setFilter] = useState<Filter>('all');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [busyId, setBusyId] = useState<string | null>(null);
    const [printing, setPrinting] = useState(false);
    const [cards, setCards] = useState<QrCardData[] | null>(null);

    const load = useCallback(async () => {
        try {
            setError(null);
            setRows(await getParentsAccess());
        } catch (e) {
            setError(apiErrorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const counts = useMemo(
        () => ({
            total: rows.length,
            nolink: rows.filter((p) => !p.linkIssuedAt).length,
            unopened: rows.filter(neverOpened).length,
        }),
        [rows]
    );

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter((p) => {
            if (filter === 'nolink' && p.linkIssuedAt) return false;
            if (filter === 'unopened' && !neverOpened(p)) return false;
            if (!q) return true;
            return (
                p.name.toLowerCase().includes(q) ||
                p.phone.toLowerCase().includes(q) ||
                (p.whatsapp || '').toLowerCase().includes(q)
            );
        });
    }, [rows, filter, query]);

    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
    const toggleAllVisible = () =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) visible.forEach((p) => next.delete(p.id));
            else visible.forEach((p) => next.add(p.id));
            return next;
        });

    const selectWithoutLink = () => setSelected(new Set(rows.filter((p) => !p.linkIssuedAt).map((p) => p.id)));

    const sendWhatsApp = async (p: ParentAccessRow) => {
        const number = whatsappNumber(p.whatsapp || p.phone);
        if (!number) {
            setNotice({ kind: 'warn', text: `Aucun numéro valide pour ${p.name}.` });
            return;
        }
        if (p.linkIssuedAt && !window.confirm("Un nouveau lien va être créé : l'ancien lien de ce parent ne fonctionnera plus.")) return;
        const tab = window.open('', '_blank');
        setBusyId(p.id);
        try {
            const { rawToken } = await regenerateParentToken(p.id);
            const text = `${parentPortalMessage(p.name)}\n${publicUrl('/p/' + rawToken)}`;
            const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
            if (tab) tab.location.href = url;
            else window.open(url, '_blank');
            setNotice({ kind: 'ok', text: `Lien envoyé via WhatsApp à ${p.name}.` });
            await load();
        } catch (e) {
            tab?.close();
            setNotice({ kind: 'warn', text: apiErrorMessage(e) });
        } finally {
            setBusyId(null);
        }
    };

    const printSelected = async () => {
        const ids = rows.filter((p) => selected.has(p.id)).map((p) => p.id);
        if (ids.length === 0) return;
        if (ids.length > 200) {
            setNotice({ kind: 'warn', text: 'Maximum 200 parents à la fois.' });
            return;
        }
        const withLink = rows.filter((p) => selected.has(p.id) && p.linkIssuedAt).length;
        const msg =
            `${ids.length} nouveau(x) lien(s) vont être créés.` +
            (withLink > 0 ? ` Les anciens liens de ${withLink} parent(s) ne fonctionneront plus.` : '');
        if (!window.confirm(msg)) return;
        setPrinting(true);
        try {
            const issued = await issueParentLinks(ids);
            const byId = new Map(rows.map((p) => [p.id, p]));
            setCards(
                issued.map(({ id, rawToken }) => {
                    const p = byId.get(id)!;
                    return {
                        id,
                        parentName: p?.name ?? '',
                        childrenNames: p ? p.children.map((c) => `${c.name} ${c.surname}`.trim()) : [],
                        url: publicUrl('/p/' + rawToken),
                    };
                })
            );
        } catch (e) {
            setNotice({ kind: 'warn', text: apiErrorMessage(e) });
        } finally {
            setPrinting(false);
        }
    };

    const closeCards = async () => {
        const n = cards?.length ?? 0;
        setCards(null);
        setSelected(new Set());
        setNotice({
            kind: 'warn',
            text: `Rappel : les anciens liens de ces ${n} parent(s) ne fonctionnent plus. Distribuez les nouvelles cartes.`,
        });
        await load();
    };

    const chip = (key: Filter, label: string, n: number) => (
        <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700'
            }`}
        >
            {label} ({n})
        </button>
    );

    const waButton = (p: ParentAccessRow) => (
        <button
            onClick={() => sendWhatsApp(p)}
            disabled={busyId === p.id}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
            <MessageCircle size={14} /> {busyId === p.id ? 'Envoi…' : 'Envoyer par WhatsApp'}
        </button>
    );

    if (cards) return <QrCardsPrint schoolName={profile.schoolName} cards={cards} onClose={closeCards} />;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Accès parents</h1>
                <p className="mt-1 text-slate-500 dark:text-slate-400">Envoyez les liens par WhatsApp ou imprimez des cartes QR.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                    { label: 'Total parents', value: counts.total, icon: Users, cls: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300' },
                    { label: 'Sans lien', value: counts.nolink, icon: Link2Off, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' },
                    { label: 'Lien jamais ouvert', value: counts.unopened, icon: EyeOff, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
                ].map(({ label, value, icon: Icon, cls }) => (
                    <div key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cls}`}>
                            <Icon size={22} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {notice && (
                <div
                    className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                        notice.kind === 'ok'
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                    }`}
                >
                    {notice.kind === 'ok' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
                    <span className="flex-1">{notice.text}</span>
                    <button onClick={() => setNotice(null)} aria-label="Fermer"><X size={16} /></button>
                </div>
            )}

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                    {chip('all', 'Tous', counts.total)}
                    {chip('nolink', 'Sans lien', counts.nolink)}
                    {chip('unopened', 'Lien jamais ouvert', counts.unopened)}
                </div>
                <div className="relative w-full lg:w-72">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Nom ou téléphone…"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    onClick={selectWithoutLink}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                    Sélectionner les parents sans lien
                </button>
                {selected.size > 0 && (
                    <button onClick={() => setSelected(new Set())} className="px-2 py-2 text-sm text-slate-500 hover:underline dark:text-slate-400">
                        Désélectionner
                    </button>
                )}
                <button
                    onClick={printSelected}
                    disabled={selected.size === 0 || printing}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    <QrCode size={16} /> {printing ? 'Création…' : `Imprimer les cartes QR (${selected.size})`}
                </button>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {loading ? (
                <p className="py-10 text-center text-slate-500 dark:text-slate-400">Chargement…</p>
            ) : visible.length === 0 ? (
                <p className="py-10 text-center text-slate-500 dark:text-slate-400">Aucun parent.</p>
            ) : (
                <>
                    {/* Table md+ */}
                    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 md:block">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">
                                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Tout sélectionner" />
                                    </th>
                                    <th className="px-4 py-3">Parent</th>
                                    <th className="px-4 py-3">Enfants</th>
                                    <th className="px-4 py-3">Statut</th>
                                    <th className="px-4 py-3">Lien créé</th>
                                    <th className="px-4 py-3">Dernière visite</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {visible.map((p) => (
                                    <tr key={p.id} className="text-slate-700 dark:text-slate-200">
                                        <td className="px-4 py-3">
                                            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Sélectionner ${p.name}`} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{p.whatsapp || p.phone}</p>
                                        </td>
                                        <td className="max-w-[220px] truncate px-4 py-3 text-slate-500 dark:text-slate-400">{childrenLabel(p) || '—'}</td>
                                        <td className="px-4 py-3"><Status p={p} /></td>
                                        <td className="px-4 py-3">{fmt(p.linkIssuedAt)}</td>
                                        <td className="px-4 py-3">{fmt(p.lastVisitAt)}</td>
                                        <td className="px-4 py-3 text-right">{waButton(p)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Cards on phones */}
                    <div className="space-y-3 md:hidden">
                        {visible.map((p) => (
                            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        className="mt-1"
                                        checked={selected.has(p.id)}
                                        onChange={() => toggle(p.id)}
                                        aria-label={`Sélectionner ${p.name}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="truncate font-medium text-slate-900 dark:text-white">{p.name}</p>
                                            <Status p={p} />
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{p.whatsapp || p.phone}</p>
                                        {p.children.length > 0 && (
                                            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{childrenLabel(p)}</p>
                                        )}
                                        <p className="mt-1 text-xs text-slate-400">
                                            Lien : {fmt(p.linkIssuedAt)} · Visite : {fmt(p.lastVisitAt)}
                                        </p>
                                        <div className="mt-3">{waButton(p)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
