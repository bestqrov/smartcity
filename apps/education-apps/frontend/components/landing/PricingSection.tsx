'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Messages } from '@/lib/landing/messages';
import { INSTITUTION_TYPES, type InstitutionType } from '@/lib/institutionTypes';
import { fetchPublicPacks, type PublicPack } from '@/lib/services/packs';
import {
    OFFER_PERIODS,
    fetchPartnerOffer,
    formatOfferMoney,
    offerPerMonth,
    offerPrice,
    offerSavingPercent,
    type OfferPeriod,
    type PartnerOfferPrices,
} from '@/lib/services/partnerOffer';

const OFFER_LABEL_KEYS: Record<OfferPeriod, keyof Messages> = { MONTHLY: 'po_monthly', SEMIANNUAL: 'po_semi', YEARLY: 'po_yearly' };

const TYPE_TITLE_KEYS: Record<InstitutionType, keyof Messages> = {
    PRIVATE_SCHOOL: 'ty1',
    TUTORING_CENTER: 'ty2',
    VOCATIONAL_TRAINING: 'ty3',
    LANGUAGE_CENTER: 'ty4',
    CRECHE: 'ty5',
};

type Billing = 'm' | 'y';
type PacksState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; packs: PublicPack[] };

const fill = (template: string, n: number) => template.replace('{n}', String(n));

const limitsLine = (pack: PublicPack, type: InstitutionType, m: Messages): string => {
    const creche = type === 'CRECHE';
    const students =
        pack.maxStudents === null
            ? creche ? m.lim_children_unlimited : m.lim_students_unlimited
            : fill(creche ? m.lim_children : m.lim_students, pack.maxStudents);
    const branches =
        pack.maxBranches === null
            ? m.lim_branches_unlimited
            : pack.maxBranches === 1
            ? m.lim_branch_one
            : pack.maxBranches === 2
            ? m.lim_branches_two
            : fill(m.lim_branches, pack.maxBranches);
    return `${students} · ${branches}`;
};

interface Props {
    m: Messages;
    type: InstitutionType;
    onTypeChange: (type: InstitutionType) => void;
    refCode?: string;
}

export default function PricingSection({ m, type, onTypeChange, refCode }: Props) {
    const refParam = refCode ? `&ref=${encodeURIComponent(refCode)}` : '';
    const [billing, setBilling] = useState<Billing>('m');
    const [state, setState] = useState<PacksState>({ status: 'loading' });
    const [offer, setOffer] = useState<PartnerOfferPrices | null>(null);
    const [showStandard, setShowStandard] = useState(false);

    // A partner link may unlock the partner offer; any failure just leaves the normal packs.
    useEffect(() => {
        let cancelled = false;
        setOffer(null);
        if (!refCode) return;
        fetchPartnerOffer(refCode)
            .then((result) => !cancelled && setOffer(result.eligible && result.offer ? result.offer : null))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [refCode]);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        fetchPublicPacks(type)
            .then((packs) => !cancelled && setState({ status: 'ok', packs }))
            .catch(() => !cancelled && setState({ status: 'error' }));
        return () => {
            cancelled = true;
        };
    }, [type]);

    const price = (pack: PublicPack) => (billing === 'm' ? pack.monthlyPrice : pack.yearlyPrice);
    const twoMonthsFree = (pack: PublicPack) => pack.yearlyPrice < 12 * pack.monthlyPrice;

    return (
        <section id="pricing" className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center text-3xl font-extrabold">{m.p_title}</h2>
            <p className="mb-6 mt-2 text-center text-slate-400">{m.p_sub}</p>

            <p className="mb-2 text-center text-sm text-slate-400">{m.pick_type}</p>
            <div className="mb-5 flex flex-wrap justify-center gap-2">
                {INSTITUTION_TYPES.map((item) => (
                    <button
                        key={item}
                        type="button"
                        aria-pressed={type === item}
                        onClick={() => onTypeChange(item)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                            type === item
                                ? 'border-indigo-400 bg-indigo-500 text-white'
                                : 'border-[#22294a] bg-[#131a30] text-slate-200 hover:bg-[#1a2342]'
                        }`}
                    >
                        {m[TYPE_TITLE_KEYS[item]]}
                    </button>
                ))}
            </div>

            {offer && (
                <div className="mx-auto mb-8 max-w-4xl rounded-3xl border-2 border-amber-400/70 bg-gradient-to-b from-amber-400/10 to-transparent p-5">
                    <div className="mb-4 text-center">
                        <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-slate-900">{m.po_badge}</span>
                        <p className="mt-2 text-sm text-slate-300">{m.po_sub}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                        {OFFER_PERIODS.map((period) => {
                            const saving = offerSavingPercent(offer, period);
                            return (
                                <div key={period} className="rounded-2xl border border-[#22294a] bg-[#131a30] p-6 text-center">
                                    <h3 className="text-lg font-bold">{m[OFFER_LABEL_KEYS[period]]}</h3>
                                    <p className="mt-2 text-4xl font-extrabold">
                                        {formatOfferMoney(offerPrice(offer, period))}{' '}
                                        <small className="text-sm font-semibold text-slate-400">
                                            MAD{period === 'MONTHLY' ? m.per_m : ''}
                                        </small>
                                    </p>
                                    {period !== 'MONTHLY' && (
                                        <p className="mt-1 text-sm text-slate-400">
                                            {m.po_approx.replace('{n}', formatOfferMoney(offerPerMonth(offer, period)))}
                                        </p>
                                    )}
                                    {saving !== null && (
                                        <p className="mt-1 text-xs font-semibold text-emerald-400">{m.po_save.replace('{n}', String(saving))}</p>
                                    )}
                                    <Link
                                        href={`/signup?type=${type}${refParam}&offer=${period}`}
                                        className="mt-4 block rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-5 py-3 text-center font-bold text-slate-900"
                                    >
                                        {m.po_cta}
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 text-center">
                        <button
                            type="button"
                            aria-expanded={showStandard}
                            onClick={() => setShowStandard((value) => !value)}
                            className="text-sm font-semibold text-slate-400 underline hover:text-slate-200"
                        >
                            {showStandard ? m.po_std_hide : m.po_std_show}
                        </button>
                    </div>
                </div>
            )}

            {(!offer || showStandard) && (
            <>
            <div className="mb-8 flex justify-center gap-2">
                {(['m', 'y'] as Billing[]).map((option) => (
                    <button
                        key={option}
                        type="button"
                        aria-pressed={billing === option}
                        onClick={() => setBilling(option)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${
                            billing === option
                                ? 'border-indigo-400 bg-indigo-500 text-white'
                                : 'border-[#22294a] bg-[#131a30] text-slate-200 hover:bg-[#1a2342]'
                        }`}
                    >
                        {option === 'm' ? m.monthly : m.yearly}
                    </button>
                ))}
            </div>

            {state.status === 'loading' && (
                <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-72 animate-pulse rounded-2xl border border-[#22294a] bg-[#131a30]" />
                    ))}
                </div>
            )}

            {(state.status === 'error' || (state.status === 'ok' && state.packs.length === 0)) && (
                <div className="mx-auto max-w-md rounded-2xl border border-[#22294a] bg-[#131a30] p-6 text-center">
                    <p className="text-slate-300">{m.packs_error}</p>
                    <Link href={`/signup?type=${type}${refParam}`} className="mt-4 inline-block rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 px-5 py-2.5 font-bold text-white">
                        {m.packs_error_cta}
                    </Link>
                </div>
            )}

            {state.status === 'ok' && state.packs.length > 0 && (
                <div className={`mx-auto grid gap-4 ${state.packs.length === 1 ? 'max-w-sm' : state.packs.length === 2 ? 'max-w-3xl md:grid-cols-2' : 'md:grid-cols-3'}`}>
                    {state.packs.map((pack) => {
                        const baseLines = type === 'CRECHE' ? [m.c1, m.c3] : [m.a1, m.a2];
                        return (
                            <div
                                key={pack.code}
                                className={`relative rounded-2xl bg-[#131a30] p-6 ${
                                    pack.recommended ? 'border-2 border-indigo-400 md:-translate-y-1.5' : 'border border-[#22294a]'
                                }`}
                            >
                                {pack.recommended && (
                                    <span className="absolute -top-3 start-5 rounded-full bg-indigo-500 px-3 py-0.5 text-xs font-bold text-white">
                                        {m.popular}
                                    </span>
                                )}
                                <h3 className="text-lg font-bold">{pack.name}</h3>
                                <p className="mt-2 text-4xl font-extrabold">
                                    {price(pack).toLocaleString('fr-FR')}{' '}
                                    <small className="text-sm font-semibold text-slate-400">
                                        MAD{billing === 'm' ? m.per_m : m.per_y}
                                    </small>
                                </p>
                                {billing === 'y' && twoMonthsFree(pack) && (
                                    <p className="mt-1 text-xs font-semibold text-emerald-400">{m.yearly_note}</p>
                                )}
                                <p className="mb-3 mt-2 text-sm text-slate-400">{limitsLine(pack, type, m)}</p>
                                <ul className="mb-5 space-y-1.5 text-sm">
                                    {baseLines.map((line) => (
                                        <li key={line} className="flex gap-2">
                                            <span className="font-extrabold text-emerald-400">✓</span>
                                            {line}
                                        </li>
                                    ))}
                                    {pack.features.map((feature) => (
                                        <li key={feature} className="flex gap-2">
                                            <span className="font-extrabold text-emerald-400">✓</span>
                                            <span>
                                                {m[`feat_${feature}` as keyof Messages]}
                                                {feature === 'DAILY_LOG' && (
                                                    <span className="ms-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                                                        {m.soon}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={`/signup?type=${type}&pack=${pack.code}${refParam}`}
                                    className={`block rounded-xl px-5 py-3 text-center font-bold ${
                                        pack.recommended
                                            ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white'
                                            : 'border border-[#22294a] text-slate-100 hover:bg-[#1a2342]'
                                    }`}
                                >
                                    {m.try}
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
            </>
            )}
        </section>
    );
}
