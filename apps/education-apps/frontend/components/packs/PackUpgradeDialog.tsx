// frontend/components/packs/PackUpgradeDialog.tsx
'use client';

// Opens when the school has no room for the students being added. It shows the same packs as the landing
// page (GET /packs/public for the school's type), with the same limits line. ADMIN and OWNER can move to a
// bigger pack; a SECRETARY only sees the numbers.
// Browse mode (no `details`, opened from «Mon abonnement»): every other pack can be picked. A bigger pack that holds
// the school's students and branches applies at once (same upgrade flow); a smaller one becomes a request to the super admin.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { messages } from '@/lib/landing/messages';
import { PACK_FEATURES } from '@/lib/packs';
import { limitMessage, limitsLine, type StudentLimitDetails } from '@/lib/packs/limits';
import { apiErrorMessage, fetchPublicPacks, type PublicPack } from '@/lib/services/packs';
import { getSchoolCapacity, upgradePack, type SchoolCapacity, type UpgradeResult } from '@/lib/services/subscription';
import { createSchoolRequest } from '@/lib/services/schoolRequests';

import { appLocale, useI18n } from '@/lib/i18n/I18nProvider';
interface Props {
    details?: StudentLimitDetails; // absent = browse mode
    onDone: (upgraded: boolean) => void;
}

type Billing = 'm' | 'y';

type Kind = 'students' | 'branches';
const room = (pack: PublicPack, kind: Kind = 'students') => {
    const max = kind === 'branches' ? pack.maxBranches : pack.maxStudents;
    return max === null ? Infinity : max;
};
// Students: the smallest pack that fits (unchanged). Branches: the cheapest pack that fits.
const cheapestFirst = (kind: Kind) => (a: PublicPack, b: PublicPack) =>
    kind === 'branches' ? a.monthlyPrice - b.monthlyPrice : room(a) - room(b);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
const featureLabel = (key: string) => PACK_FEATURES.find((feature) => feature.key === key)?.label ?? key;

export default function PackUpgradeDialog({ details, onDone }: Props) {
    const { tr } = useI18n();
    const role = useAuthStore((state) => state.user?.role);
    const canUpgrade = role === 'ADMIN' || role === 'OWNER';
    const [capacity, setCapacity] = useState<SchoolCapacity | null>(null);
    const [packs, setPacks] = useState<PublicPack[] | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [billing, setBilling] = useState<Billing>('m');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState<UpgradeResult | null>(null);
    const [requested, setRequested] = useState<string | null>(null); // name of the smaller pack asked for
    const [note, setNote] = useState('');

    const browse = !details;
    const kind: Kind = details?.kind ?? 'students';
    const needed = details ? details.current + details.adding : 0;

    useEffect(() => {
        let cancelled = false;
        getSchoolCapacity()
            .then(async (cap) => {
                const list = await fetchPublicPacks(cap.institutionType);
                if (cancelled) return;
                setCapacity(cap);
                setPacks(list);
                const fitting = list.filter((pack) => pack.code !== cap.packCode && room(pack, kind) >= needed).sort(cheapestFirst(kind));
                setSelected(details ? fitting[0]?.code ?? null : null);
            })
            .catch((err) => !cancelled && setError(apiErrorMessage(err)));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [needed, kind]);

    const currentPack = packs?.find((pack) => pack.code === capacity?.packCode) ?? null;
    // Browse: bigger = pricier than the current pack and holding today's students and branches; smaller = cheaper.
    const holdsUsage = (pack: PublicPack) =>
        !!capacity && room(pack, 'students') >= capacity.current && room(pack, 'branches') >= capacity.branches.current;
    const isBigger = (pack: PublicPack) => !currentPack || pack.monthlyPrice > currentPack.monthlyPrice;
    const isSmaller = (pack: PublicPack) => !!currentPack && pack.monthlyPrice < currentPack.monthlyPrice;
    const fitting = (packs ?? []).filter((pack) =>
        pack.code !== capacity?.packCode && (browse ? (isBigger(pack) && holdsUsage(pack)) || isSmaller(pack) : room(pack, kind) >= needed)
    );
    const recommended = [...fitting].sort(cheapestFirst(kind))[0]?.code;
    const chosen = packs?.find((pack) => pack.code === selected) ?? null;

    const downgrade = browse && !!chosen && isSmaller(chosen);

    const confirm = async () => {
        if (!chosen) return;
        setSaving(true);
        setError('');
        try {
            if (downgrade) {
                await createSchoolRequest({ kind: 'PACK_DOWNGRADE', targetPackCode: chosen.code, message: note.trim() || undefined });
                setRequested(chosen.name);
                return;
            }
            setDone(await upgradePack(chosen.code, kind === 'branches' ? 'BRANCH_LIMIT' : 'STUDENT_LIMIT'));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const close = () => {
        if (saving) return;
        onDone(done !== null || requested !== null);
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pack-upgrade-title"
            onClick={(event) => event.target === event.currentTarget && close()}
        >
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800">
                <div className="flex items-start justify-between gap-4 border-b p-5 dark:border-gray-700">
                    <div>
                        <h2 id="pack-upgrade-title" className="text-lg font-bold text-gray-900 dark:text-white">
                            {done ? tr("Pack mis à jour") : requested ? tr("Demande envoyée") : browse ? tr("Changer de pack") : tr("Limite de votre pack atteinte")}
                        </h2>
                        {!done && !requested && details && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{limitMessage(details)}</p>}
                    </div>
                    <button type="button" onClick={close} disabled={saving} aria-label={tr("Fermer")} className="text-gray-400 disabled:opacity-50 hover:text-gray-600 dark:hover:text-gray-200">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {requested ? (
                        <p className="text-gray-800 dark:text-gray-100">{tr("Votre demande de passage au pack « {name} » a été envoyée. L'équipe vous répondra dans « Mon abonnement ».", { name: requested })}</p>
                    ) : done ? (
                        <div className="space-y-2 text-gray-800 dark:text-gray-100">
                            <p>{tr("Votre pack")}<strong>« {done.packName} »</strong>{tr("est actif dès maintenant.")}</p>
                            {done.dueAt && <p>{tr("Le paiement du nouveau tarif est attendu avant le")}{' '}<strong>{fmtDate(done.dueAt)}</strong>.</p>}
                        </div>
                    ) : !packs || !capacity ? (
                        error ? (
                            <p role="alert" className="text-red-600 dark:text-red-300">{tr(error)}</p>
                        ) : (
                            <p role="status" className="text-gray-500 dark:text-gray-400">{tr("Chargement des packs…")}</p>
                        )
                    ) : (
                        <>
                            <div className="mb-4 flex justify-center gap-2">
                                {(['m', 'y'] as Billing[]).map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        aria-pressed={billing === option}
                                        onClick={() => setBilling(option)}
                                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                                            billing === option
                                                ? 'border-indigo-500 bg-indigo-600 text-white'
                                                : 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200'
                                        }`}
                                    >
                                        {option === 'm' ? tr("Mensuel") : tr("Annuel")}
                                    </button>
                                ))}
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                {packs.map((pack) => {
                                    const current = pack.code === capacity.packCode;
                                    const fits = !current && fitting.some((p) => p.code === pack.code);
                                    const smaller = browse && isSmaller(pack);
                                    const isSelected = pack.code === selected;
                                    return (
                                        <button
                                            key={pack.code}
                                            type="button"
                                            disabled={!fits || !canUpgrade}
                                            aria-pressed={isSelected}
                                            onClick={() => setSelected(pack.code)}
                                            className={`rounded-xl border-2 p-4 text-start transition ${
                                                isSelected && fits
                                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                                    : 'border-gray-200 dark:border-gray-700'
                                            } ${fits ? '' : 'opacity-50'}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-gray-900 dark:text-white">{pack.name}</span>
                                                {current ? (
                                                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-600 dark:text-gray-100">{tr("Pack actuel")}</span>
                                                ) : smaller ? (
                                                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">{tr("Sur demande")}</span>
                                                ) : !fits ? (
                                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">{tr("Insuffisant")}</span>
                                                ) : pack.code === recommended ? (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">{tr("Recommandé")}</span>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                                                <bdi dir="ltr">{billing === 'm' ? pack.monthlyPrice : pack.yearlyPrice}</bdi>{' '}
                                                <small className="text-sm font-semibold text-gray-500 dark:text-gray-400">{tr("MAD")}{billing === 'm' ? tr(" / mois") : tr(" / an")}</small>
                                            </p>
                                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{limitsLine(pack, capacity.institutionType, messages.fr)}</p>
                                            {pack.features.length > 0 && (
                                                <ul className="mt-2 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                    {pack.features.map((feature) => (
                                                        <li key={feature}>✓ {featureLabel(feature)}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {!canUpgrade ? (
                                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{tr("Demandez à l'administrateur de l'établissement de changer de pack.")}</p>
                            ) : browse ? (
                                downgrade ? (
                                    <div className="mt-4 space-y-2">
                                        <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">{tr("Le passage à un pack inférieur est traité par l'équipe Arwa (facturation et limites en cours). Votre demande lui sera envoyée.")}</p>
                                        <label htmlFor="downgrade-note" className="block text-sm font-semibold text-gray-700 dark:text-gray-200">{tr("Message (facultatif)")}</label>
                                        <textarea id="downgrade-note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
                                    </div>
                                ) : (
                                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{chosen ? tr("Votre nouveau pack est actif immédiatement.") : tr("Choisissez un pack.")}{chosen && capacity.upgradeDueAt && <>{' '}{tr("Vous avez jusqu'au")}{' '}<strong>{fmtDate(capacity.upgradeDueAt)}</strong>{' '}{tr("pour régler le nouveau tarif.")}</>}</p>
                                )
                            ) : fitting.length === 0 ? (
                                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">{tr("Aucun pack ne couvre ce nombre")}{kind === 'branches' ? <>{tr("d'établissements")}</> : <>{tr("d'élèves")}</>}{tr(". Contactez l'équipe Arwa.")}</p>
                            ) : (
                                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{tr("Votre nouveau pack est actif immédiatement.")}{capacity.upgradeDueAt && <>{' '}{tr("Vous avez jusqu'au")}{' '}<strong>{fmtDate(capacity.upgradeDueAt)}</strong>{' '}{tr("pour régler le nouveau tarif.")}</>}
                                </p>
                            )}
                            {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{tr(error)}</p>}
                        </>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t p-5 dark:border-gray-700">
                    {done || requested ? (
                        <button type="button" onClick={close} className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700">{tr("Continuer")}</button>
                    ) : (
                        <>
                            <button type="button" onClick={close} className="rounded-lg border border-gray-300 px-5 py-2 font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">{tr("Annuler")}</button>
                            {canUpgrade && chosen && fitting.some((pack) => pack.code === chosen.code) && (
                                <button
                                    type="button"
                                    onClick={confirm}
                                    disabled={saving}
                                    className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                                >
                                    {saving ? tr("Mise à jour…") : downgrade ? tr("Demander le pack {name}", { name: chosen.name }) : tr("Passer au pack {name}", { name: chosen.name })}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
