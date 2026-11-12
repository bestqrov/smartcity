// frontend/components/packs/PackUpgradeDialog.tsx
'use client';

// Opens when the school has no room for the students being added. It shows the same packs as the landing
// page (GET /packs/public for the school's type), with the same limits line. ADMIN and OWNER can move to a
// bigger pack; a SECRETARY only sees the numbers.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import { messages } from '@/lib/landing/messages';
import { PACK_FEATURES } from '@/lib/packs';
import { limitsLine, studentLimitMessage, type StudentLimitDetails } from '@/lib/packs/limits';
import { apiErrorMessage, fetchPublicPacks, type PublicPack } from '@/lib/services/packs';
import { getSchoolCapacity, upgradePack, type SchoolCapacity, type UpgradeResult } from '@/lib/services/subscription';

interface Props {
    details: StudentLimitDetails;
    onDone: (upgraded: boolean) => void;
}

type Billing = 'm' | 'y';

const room = (pack: PublicPack) => (pack.maxStudents === null ? Infinity : pack.maxStudents);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const featureLabel = (key: string) => PACK_FEATURES.find((feature) => feature.key === key)?.label ?? key;

export default function PackUpgradeDialog({ details, onDone }: Props) {
    const role = useAuthStore((state) => state.user?.role);
    const canUpgrade = role === 'ADMIN' || role === 'OWNER';
    const [capacity, setCapacity] = useState<SchoolCapacity | null>(null);
    const [packs, setPacks] = useState<PublicPack[] | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [billing, setBilling] = useState<Billing>('m');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState<UpgradeResult | null>(null);

    const needed = details.current + details.adding;

    useEffect(() => {
        let cancelled = false;
        getSchoolCapacity()
            .then(async (cap) => {
                const list = await fetchPublicPacks(cap.institutionType);
                if (cancelled) return;
                setCapacity(cap);
                setPacks(list);
                const fitting = list.filter((pack) => room(pack) >= needed).sort((a, b) => room(a) - room(b));
                setSelected(fitting[0]?.code ?? null);
            })
            .catch((err) => !cancelled && setError(apiErrorMessage(err)));
        return () => {
            cancelled = true;
        };
    }, [needed]);

    const fitting = (packs ?? []).filter((pack) => room(pack) >= needed);
    const recommended = [...fitting].sort((a, b) => room(a) - room(b))[0]?.code;
    const chosen = packs?.find((pack) => pack.code === selected) ?? null;

    const confirm = async () => {
        if (!chosen) return;
        setSaving(true);
        setError('');
        try {
            setDone(await upgradePack(chosen.code));
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const close = () => onDone(done !== null);

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
                            {done ? 'Pack mis à jour' : 'Limite de votre pack atteinte'}
                        </h2>
                        {!done && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{studentLimitMessage(details)}</p>}
                    </div>
                    <button type="button" onClick={close} aria-label="Fermer" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {done ? (
                        <div className="space-y-2 text-gray-800 dark:text-gray-100">
                            <p>
                                Votre pack <strong>« {done.packName} »</strong> est actif dès maintenant.
                            </p>
                            {done.dueAt && <p>Le paiement du nouveau tarif est attendu avant le <strong>{fmtDate(done.dueAt)}</strong>.</p>}
                        </div>
                    ) : !packs || !capacity ? (
                        error ? (
                            <p role="alert" className="text-red-600 dark:text-red-300">{error}</p>
                        ) : (
                            <p role="status" className="text-gray-500 dark:text-gray-400">Chargement des packs…</p>
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
                                        {option === 'm' ? 'Mensuel' : 'Annuel'}
                                    </button>
                                ))}
                            </div>

                            <div className="grid gap-3 md:grid-cols-3">
                                {packs.map((pack) => {
                                    const current = pack.code === capacity.packCode;
                                    const fits = room(pack) >= needed && !current;
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
                                                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-600 dark:text-gray-100">Pack actuel</span>
                                                ) : !fits ? (
                                                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">Insuffisant</span>
                                                ) : pack.code === recommended ? (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Recommandé</span>
                                                ) : null}
                                            </div>
                                            <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                                                {billing === 'm' ? pack.monthlyPrice : pack.yearlyPrice}{' '}
                                                <small className="text-sm font-semibold text-gray-500">MAD{billing === 'm' ? ' / mois' : ' / an'}</small>
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
                                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                    Demandez à l&apos;administrateur de l&apos;établissement de changer de pack.
                                </p>
                            ) : fitting.length === 0 ? (
                                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                    Aucun pack ne couvre ce nombre d&apos;élèves. Contactez l&apos;équipe Arwa.
                                </p>
                            ) : (
                                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                                    Votre nouveau pack est actif immédiatement.
                                    {capacity.upgradeDueAt && <> Vous avez jusqu&apos;au <strong>{fmtDate(capacity.upgradeDueAt)}</strong> pour régler le nouveau tarif.</>}
                                </p>
                            )}
                            {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
                        </>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t p-5 dark:border-gray-700">
                    {done ? (
                        <button type="button" onClick={close} className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700">
                            Continuer
                        </button>
                    ) : (
                        <>
                            <button type="button" onClick={close} className="rounded-lg border border-gray-300 px-5 py-2 font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">
                                Annuler
                            </button>
                            {canUpgrade && chosen && fitting.some((pack) => pack.code === chosen.code) && (
                                <button
                                    type="button"
                                    onClick={confirm}
                                    disabled={saving}
                                    className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                                >
                                    {saving ? 'Mise à jour…' : `Passer au pack ${chosen.name}`}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
