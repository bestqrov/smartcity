'use client';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import Input from '../../components/Input';
import Button from '../../components/Button';
import useAuthStore, { setActiveBranchId } from '../../store/useAuthStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { signupSchool, SignupSchoolData } from '../../lib/services/schools';
import { GraduationCap, X } from 'lucide-react';
import LangSwitcher from '@/components/LangSwitcher';
import { I18nProvider, useI18n } from '@/lib/i18n/I18nProvider';
import { INSTITUTION_TYPES, INSTITUTION_TYPE_LABELS, isInstitutionType, type InstitutionType } from '../../lib/institutionTypes';
import { checkReferralCode } from '../../lib/services/salesAgents';
import { whatsappUrl } from '../../lib/landing/whatsapp';
import { fetchPublicPacks, type PublicPack } from '../../lib/services/packs';
import PlatformBrand from '@/components/PlatformBrand';
import { usePublicPlatform } from '@/lib/services/platformSettings';
import {
    OFFER_PERIODS,
    fetchPartnerOffer,
    formatOfferMoney,
    isOfferPeriod,
    offerDiscount,
    packBasePrice,
    packOfferPrice,
    type OfferPeriod,
    type PartnerOfferDiscounts,
} from '../../lib/services/partnerOffer';

const OFFER_LABELS: Record<OfferPeriod, string> = { MONTHLY: 'Mensuel', SEMIANNUAL: '6 mois', YEARLY: 'Annuel' };
const PERIOD_SUFFIX: Record<OfferPeriod, string> = { MONTHLY: ' / mois', SEMIANNUAL: ' / 6 mois', YEARLY: ' / an' };

function SignupForm() {
    const { tr } = useI18n();
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);
    const setAccessTokenState = useAuthStore((state) => state.setAccessToken);

    const searchParams = useSearchParams();
    const platform = usePublicPlatform();
    // Periods offered at signup are chosen by the super admin.
    const allowedPeriods = OFFER_PERIODS.filter((period) => platform.signupPeriods.includes(period));
    const initialType = searchParams.get('type');
    const [form, setForm] = useState({ ownerName: '', ownerEmail: '', ownerPhone: '', password: '' });
    const [institutionType, setInstitutionType] = useState<InstitutionType | ''>(
        isInstitutionType(initialType) ? initialType : ''
    );
    const [packCode, setPackCode] = useState<string>(searchParams.get('pack') ?? '');
    const [packs, setPacks] = useState<PublicPack[]>([]);
    const [referralCode, setReferralCode] = useState<string>((searchParams.get('ref') ?? '').trim().toUpperCase());
    // Offer prices are public; `eligible` (a partner's code was checked) is what unlocks the offer.
    const [prices, setPrices] = useState<PartnerOfferDiscounts | null>(null);
    const [eligible, setEligible] = useState(false);
    const initialOffer = searchParams.get('offer');
    const [offerPeriod, setOfferPeriod] = useState<OfferPeriod>(isOfferPeriod(initialOffer) ? initialOffer : 'MONTHLY');
    // The offer asked for on the landing; dropped by "Continuer sans l'offre".
    const [wantsOffer, setWantsOffer] = useState<boolean>(isOfferPeriod(initialOffer));
    const codeInput = useRef<HTMLInputElement>(null);
    const offer = eligible ? prices : null; // the unlocked offer
    const lockedOffer = !eligible && wantsOffer && prices ? prices : null;
    const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const selectedPack = packs.find((pack) => pack.code === packCode) ?? null;
    const finalPrice = selectedPack
        ? offer
            ? packOfferPrice(selectedPack, offer, offerPeriod)
            : packBasePrice(selectedPack, offerPeriod)
        : 0;

    // A period the platform no longer offers falls back to the first one offered.
    useEffect(() => {
        if (allowedPeriods.length > 0 && !allowedPeriods.includes(offerPeriod)) setOfferPeriod(allowedPeriods[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [platform.signupPeriods.join(','), offerPeriod]);

    // The code a pending check is for; a response for an older code is dropped so it can't overwrite the status.
    const checkedCode = useRef('');

    const verifyCode = async (code: string) => {
        checkedCode.current = code;
        setEligible(false);
        if (!code) {
            setCodeStatus('idle');
            return;
        }
        setCodeStatus('checking');
        try {
            const valid = await checkReferralCode(code);
            if (checkedCode.current !== code) return;
            setCodeStatus(valid ? 'valid' : 'invalid');
            if (valid) {
                // A partner code unlocks the discount on the packs; failure just keeps the normal prices.
                const result = await fetchPartnerOffer(code).catch(() => null);
                if (checkedCode.current === code && result?.offer) {
                    setPrices(result.offer);
                    setEligible(result.eligible);
                }
            }
        } catch {
            // network/rate-limit problem: let the server decide at submit
            if (checkedCode.current === code) setCodeStatus('idle');
        }
    };

    // A code arriving from a ?ref= link is checked right away.
    useEffect(() => {
        if (referralCode) verifyCode(referralCode);
        else fetchPartnerOffer().then((result) => setPrices(result.offer ?? null)).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Check the code shortly after typing stops, so the final price updates without leaving the field.
    useEffect(() => {
        const code = referralCode.trim();
        if (code.length < 3 || checkedCode.current === code) return;
        const timer = setTimeout(() => verifyCode(code), 600);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [referralCode]);

    // Arriving for a locked offer: put the cursor on the code field.
    useEffect(() => {
        if (wantsOffer && !eligible) codeInput.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prices === null]);

    // Load the packs that serve the chosen type; keep the requested pack if valid, else the recommended one.
    useEffect(() => {
        if (!institutionType) {
            setPacks([]);
            return;
        }
        let cancelled = false;
        fetchPublicPacks(institutionType)
            .then((list) => {
                if (cancelled) return;
                setPacks(list);
                setPackCode((current) =>
                    list.some((pack) => pack.code === current)
                        ? current
                        : list.find((pack) => pack.recommended)?.code ?? list[0]?.code ?? ''
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setPacks([]);
                    setPackCode('');
                }
            });
        return () => {
            cancelled = true;
        };
    }, [institutionType]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const update = (field: 'ownerName' | 'ownerEmail' | 'ownerPhone' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!platform.signupOpen) { setError(tr('Inscriptions fermées')); return; }
        if (!institutionType) { setError(tr('Choisissez le type de votre établissement.')); return; }
        const code = referralCode.trim();
        if (!code) { setError(tr('Le code commercial est obligatoire.')); return; }
        if (codeStatus === 'invalid') { setError(tr('Code commercial invalide.')); return; }
        const phoneDigits = form.ownerPhone.replace(/\D/g, '');
        if (phoneDigits.length < 9 || phoneDigits.length > 15) { setError(tr('Numéro GSM / WhatsApp invalide.')); return; }
        setLoading(true);
        try {
            const { token, user, branch } = await signupSchool({
                ...form,
                referralCode: code,
                institutionType,
                ...(packCode ? { packCode } : {}),
                ...(packCode ? { offerPeriod } : {}),
            });
            setAccessTokenState(token);
            setUser(user);
            setActiveBranchId(branch.id);
            router.push('/admin');
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || '';
            if (msg === 'SIGNUP_CLOSED') {
                setError(tr('Inscriptions fermées'));
            } else if (msg === 'PHONE_REQUIRED') {
                setError(tr('Numéro GSM / WhatsApp invalide.'));
            } else if (msg === 'Invalid referral code' || msg === 'Referral code is required') {
                setCodeStatus('invalid');
                setError(tr(msg === 'Invalid referral code' ? 'Code commercial invalide.' : 'Le code commercial est obligatoire.'));
            } else if (msg === 'This offer is only available through a partner') {
                setEligible(false);
                setError(tr("Cette offre n'est disponible que via un partenaire."));
            } else {
                setError(msg === 'Email already exists' ? tr('Cette adresse e-mail est déjà utilisée.') : msg || tr("L'inscription a échoué. Réessayez."));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col lg:flex-row bg-white font-sans text-slate-900 overflow-hidden">
            {/* Left Column: Branded Visual Section (Fixed height/width) */}
            <div className="hidden lg:flex lg:w-1/2 h-full relative bg-slate-900 items-center justify-center p-12 overflow-hidden group shrink-0">
                {/* Background gradient */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950 via-slate-900/95 to-slate-900/90"></div>
                </div>

                {/* Animated Branding Elements */}
                <div className="relative z-10 text-center max-w-lg px-8 animate-in fade-in zoom-in duration-1000 ease-out">
                    <div className="flex justify-center mb-8">
                        <div className="p-5 bg-white/5 backdrop-blur-xl rounded-[40px] border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] transform hover:rotate-3 transition-transform duration-500">
                            <GraduationCap size={72} className="text-white drop-shadow-glow" />
                        </div>
                    </div>
                    <h2 className="text-6xl font-black text-white mb-6 tracking-tight leading-[1.1]">
                        <PlatformBrand name={platform.platformName} accentClass="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400" />
                    </h2>
                    <div className="h-1.5 w-24 bg-indigo-500 rounded-full mx-auto mb-8 shadow-[0_0_20px_rgba(99,102,241,0.6)]"></div>
                    <p className="text-indigo-100/60 text-xl font-medium leading-relaxed">
                        {tr('Créez votre école en quelques minutes et pilotez votre établissement avec précision et élégance.')}
                    </p>
                </div>

                {/* Decorative Bottom Credits */}
                <div className="absolute bottom-8 start-0 end-0 flex justify-center items-center text-white/20 text-[10px] font-black tracking-[0.4em] uppercase font-mono">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-[1px] bg-white/20"></div>
                        <span>{tr('Gestion Administrative v2.0')}</span>
                        <div className="w-8 h-[1px] bg-white/20"></div>
                    </div>
                </div>
            </div>

            {/* Right Column: Signup Form Container */}
            <div className="w-full lg:w-1/2 h-screen flex flex-col px-8 sm:px-16 lg:px-24 py-4 lg:py-8 bg-white relative z-10 border-s border-slate-50 shadow-[-50px_0_100px_-50px_rgba(0,0,0,0.05)] rtl:shadow-[50px_0_100px_-50px_rgba(0,0,0,0.05)] overflow-y-auto custom-scrollbar">
                <div className="max-w-md w-full mx-auto flex flex-col">

                    {/* Header */}
                    <div className="mb-6 lg:mb-8 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                        <div className="mb-6 flex justify-end">
                            <LangSwitcher />
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-2 text-slate-900 leading-tight">
                            {tr('Créer votre')} <span className="text-indigo-600">{tr('école')}</span>
                        </h1>
                        <p className="text-slate-400 font-medium">{tr('Démarrez votre essai en créant votre premier établissement.')}</p>
                    </div>

                    {!platform.signupOpen && (
                        <div role="status" className="mb-6 p-4 bg-amber-50 text-amber-800 text-sm rounded-3xl border-2 border-amber-100 font-extrabold">
                            {tr('Inscriptions fermées')}
                            <span className="block font-medium">{tr('Les inscriptions sont momentanément fermées. Contactez-nous pour créer votre école.')}</span>
                        </div>
                    )}

                    {/* Error Notification */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-3xl border-2 border-red-100 flex items-center gap-4 animate-shake shadow-sm">
                            <div className="p-2 bg-red-100 rounded-2xl">
                                <X size={18} className="text-red-700" />
                            </div>
                            <span className="font-extrabold">{error}</span>
                        </div>
                    )}

                    {/* Signup Form */}
                    <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 pb-8">
                        <div className="space-y-3">
                            <label className="block text-sm font-bold text-slate-600" htmlFor="institutionType">
                                {tr('Type de votre établissement')}
                            </label>
                            <select
                                id="institutionType"
                                value={institutionType}
                                onChange={(e) => setInstitutionType(e.target.value as InstitutionType | '')}
                                required
                                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:outline-none font-bold text-lg shadow-sm"
                            >
                                <option value="">{tr('Choisir…')}</option>
                                {INSTITUTION_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {tr(INSTITUTION_TYPE_LABELS[type])}
                                    </option>
                                ))}
                            </select>

                            {lockedOffer && (
                                <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                                    <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-amber-600">{tr('Offre spéciale via Partenaire')}</p>
                                    {codeStatus === 'valid' || codeStatus === 'invalid'
                                        ? codeStatus === 'valid'
                                            ? tr("Ce code n'est pas celui d'un partenaire : la réduction nécessite le code de votre partenaire (commercial).")
                                            : tr('Code introuvable : la réduction nécessite le code de votre partenaire (commercial).')
                                        : tr('Entrez le code de votre partenaire (commercial) pour bénéficier de −{m} % / −{s} % / −{y} % sur votre pack.', { m: lockedOffer.monthlyDiscount, s: lockedOffer.semiannualDiscount, y: lockedOffer.yearlyDiscount })}
                                    {(codeStatus === 'valid' || codeStatus === 'invalid') && (
                                        <button
                                            type="button"
                                            onClick={() => setWantsOffer(false)}
                                            className="mt-2 block rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
                                        >
                                            {tr("Continuer sans l'offre")}
                                        </button>
                                    )}
                                </div>
                            )}

                            {packs.length > 0 && (
                                <div className="grid gap-2" role="radiogroup" aria-label={tr('Durée')}>
                                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{tr('Durée')}</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {allowedPeriods.map((period) => (
                                            <label
                                                key={period}
                                                className={`cursor-pointer rounded-2xl border-2 px-3 py-2 text-center ${
                                                    offerPeriod === period ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="period"
                                                    value={period}
                                                    checked={offerPeriod === period}
                                                    onChange={() => setOfferPeriod(period)}
                                                    className="sr-only"
                                                />
                                                <span className="block font-bold text-slate-800">{tr(OFFER_LABELS[period])}</span>
                                                {offer && (
                                                    <span className="block text-xs font-extrabold text-emerald-600">−{offerDiscount(offer, period)} %</span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {packs.length > 0 && (
                                <div className="grid gap-2" role="radiogroup" aria-label={tr('Pack')}>
                                    {packs.map((pack) => (
                                        <label
                                            key={pack.code}
                                            className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 px-5 py-3 ${
                                                packCode === pack.code ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 bg-slate-50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-3 font-bold text-slate-800">
                                                <input
                                                    type="radio"
                                                    name="pack"
                                                    value={pack.code}
                                                    checked={packCode === pack.code}
                                                    onChange={() => setPackCode(pack.code)}
                                                />
                                                {pack.name}
                                                {pack.recommended && (
                                                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                                        {tr('Recommandé')}
                                                    </span>
                                                )}
                                            </span>
                                            {offer ? (
                                                <span className="text-end text-sm font-semibold text-slate-500">
                                                    <span className="block text-xs line-through">{formatOfferMoney(packBasePrice(pack, offerPeriod))}{tr(' MAD')}</span>
                                                    <span className="block font-extrabold text-emerald-700">
                                                        {formatOfferMoney(packOfferPrice(pack, offer, offerPeriod))} {tr(' MAD')}{tr(PERIOD_SUFFIX[offerPeriod])}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-sm font-semibold text-slate-500">
                                                    {formatOfferMoney(packBasePrice(pack, offerPeriod))}{tr(' MAD')}{tr(PERIOD_SUFFIX[offerPeriod])}
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                    <p className="text-xs text-slate-400">{tr("{n} jours d'essai gratuit, sans carte bancaire.", { n: platform.trialDays })}</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-600" htmlFor="referralCode">
                                {tr('Code commercial')}
                            </label>
                            <input
                                id="referralCode"
                                ref={codeInput}
                                type="text"
                                value={referralCode}
                                onChange={(e) => {
                                    setReferralCode(e.target.value.toUpperCase());
                                    checkedCode.current = ''; // ignore any check still in flight
                                    setCodeStatus('idle');
                                    setEligible(false);
                                }}
                                onBlur={() => checkedCode.current !== referralCode.trim() && verifyCode(referralCode.trim())}
                                required
                                autoComplete="off"
                                placeholder={tr('Ex. YOUSSEF22')}
                                className={`w-full px-6 py-4 bg-slate-50 border-2 rounded-[2rem] focus:bg-white focus:outline-none font-bold text-lg shadow-sm tracking-wider ${
                                    lockedOffer && codeStatus !== 'valid' && codeStatus !== 'invalid' ? 'ring-4 ring-amber-300 border-amber-400 ' : ''
                                }${
                                    codeStatus === 'invalid'
                                        ? 'border-red-300 focus:border-red-500'
                                        : codeStatus === 'valid'
                                        ? 'border-emerald-300 focus:border-emerald-500'
                                        : 'border-slate-100 focus:border-indigo-500'
                                }`}
                            />
                            {codeStatus === 'checking' && <p className="text-xs text-slate-400">{tr('Vérification…')}</p>}
                            {codeStatus === 'valid' && <p className="text-xs font-semibold text-emerald-600">{tr('Code valide ✓')}</p>}
                            {codeStatus === 'invalid' && (
                                <p className="text-xs font-semibold text-red-600">{tr("Ce code n'existe pas ou n'est plus actif.")}</p>
                            )}
                            {selectedPack && (
                                <div
                                    aria-live="polite"
                                    className={`rounded-2xl border-2 px-5 py-4 ${offer ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
                                >
                                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{tr('Prix final')}</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-600">
                                        {selectedPack.name} · {tr(OFFER_LABELS[offerPeriod])}
                                    </p>
                                    {offer && (
                                        <p className="mt-1 text-sm text-slate-500">
                                            <span className="line-through">{formatOfferMoney(packBasePrice(selectedPack, offerPeriod))}{tr(' MAD')}</span>
                                            <span className="ms-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                                                {tr('−{d} % partenaire', { d: offerDiscount(offer, offerPeriod) })}
                                            </span>
                                        </p>
                                    )}
                                    <p className={`mt-1 text-3xl font-black ${offer ? 'text-emerald-700' : 'text-slate-900'}`}>
                                        {formatOfferMoney(finalPrice)}{tr(' MAD')}
                                        <span className="text-base font-semibold text-slate-500">{tr(PERIOD_SUFFIX[offerPeriod])}</span>
                                    </p>
                                    {!offer && prices && (
                                        <p className="mt-1 text-xs text-slate-500">
                                            {tr("Avec le code d'un partenaire : −{d} % sur ce prix.", { d: offerDiscount(prices, offerPeriod) })}
                                        </p>
                                    )}
                                </div>
                            )}
                            <a
                                href={whatsappUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-xs font-bold text-emerald-700 hover:underline"
                            >
                                {tr('Pas de code ? Contactez-nous sur WhatsApp')}
                            </a>
                        </div>

                        <Input
                            type="text"
                            value={form.ownerName}
                            onChange={update('ownerName')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder={tr('Votre nom')}
                        />

                        <Input
                            type="email"
                            value={form.ownerEmail}
                            onChange={update('ownerEmail')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder={tr('Adresse e-mail')}
                        />

                        <Input
                            type="tel"
                            inputMode="tel"
                            dir="ltr"
                            value={form.ownerPhone}
                            onChange={update('ownerPhone')}
                            required
                            autoComplete="tel"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm rtl:text-right"
                            placeholder={tr('GSM / WhatsApp (ex. 06 12 34 56 78)')}
                        />

                        <Input
                            type="password"
                            value={form.password}
                            onChange={update('password')}
                            required
                            minLength={8}
                            autoComplete="new-password"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder={tr('Mot de passe (8 caractères min.)')}
                        />

                        <div className="pt-4 lg:pt-6">
                            <Button isLoading={loading} disabled={loading || !platform.signupOpen} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black text-xl shadow-[0_20px_45px_-10px_rgba(79,70,229,0.4)] transform active:scale-[0.97] transition-all duration-300 flex items-center justify-center gap-4 group">
                                {loading ? tr('Création…') : tr('Créer mon compte')}
                                {!loading && (
                                    <svg className="w-6 h-6 transform group-hover:translate-x-1.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-1.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                )}
                            </Button>
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="shrink-0 pb-8 pt-2 border-t border-slate-50 flex flex-col items-center gap-4 animate-in fade-in duration-1000 delay-500 text-center">
                        <div className="flex flex-col gap-2 text-slate-400 font-medium text-xs mt-4">
                            <span>
                                {tr('Déjà un compte ?')}{' '}
                                <a href="/login" className="text-indigo-600 hover:underline font-bold">{tr('Se connecter')}</a>
                            </span>
                            {platform.supportEmail && (
                                <div className="flex items-center justify-center gap-2">
                                    <span>📧 {tr('Email :')}</span>
                                    <a href={`mailto:${platform.supportEmail}`} className="text-indigo-600 hover:underline font-bold">{platform.supportEmail}</a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .drop-shadow-glow {
                    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.3));
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-10px); }
                    40%, 80% { transform: translateX(10px); }
                }
                .animate-shake {
                    animation: shake 0.6s cubic-bezier(.36,.07,.19,.97) both;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}

export default function SignupPage() {
    // useSearchParams needs a Suspense boundary during the production build.
    return (
        <I18nProvider>
            <Suspense fallback={null}>
                <SignupForm />
            </Suspense>
        </I18nProvider>
    );
}
