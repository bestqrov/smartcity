'use client';
import React, { Suspense, useEffect, useRef, useState } from 'react';
import Input from '../../components/Input';
import Button from '../../components/Button';
import useAuthStore, { setActiveBranchId } from '../../store/useAuthStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { signupSchool, SignupSchoolData } from '../../lib/services/schools';
import { GraduationCap, Lock, X } from 'lucide-react';
import { INSTITUTION_TYPES, INSTITUTION_TYPE_LABELS, isInstitutionType, type InstitutionType } from '../../lib/institutionTypes';
import { checkReferralCode } from '../../lib/services/salesAgents';
import { whatsappUrl } from '../../lib/landing/whatsapp';
import { fetchPublicPacks, type PublicPack } from '../../lib/services/packs';
import {
    OFFER_PERIODS,
    fetchPartnerOffer,
    formatOfferMoney,
    isOfferPeriod,
    offerPerMonth,
    offerPrice,
    type OfferPeriod,
    type PartnerOfferPrices,
} from '../../lib/services/partnerOffer';

const OFFER_LABELS: Record<OfferPeriod, string> = { MONTHLY: 'Mensuel', SEMIANNUAL: '6 mois', YEARLY: 'Annuel' };

function SignupForm() {
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);
    const setAccessTokenState = useAuthStore((state) => state.setAccessToken);

    const searchParams = useSearchParams();
    const initialType = searchParams.get('type');
    const [form, setForm] = useState({ ownerName: '', ownerEmail: '', password: '' });
    const [institutionType, setInstitutionType] = useState<InstitutionType | ''>(
        isInstitutionType(initialType) ? initialType : ''
    );
    const [packCode, setPackCode] = useState<string>(searchParams.get('pack') ?? '');
    const [packs, setPacks] = useState<PublicPack[]>([]);
    const [referralCode, setReferralCode] = useState<string>((searchParams.get('ref') ?? '').trim().toUpperCase());
    // Offer prices are public; `eligible` (a partner's code was checked) is what unlocks the offer.
    const [prices, setPrices] = useState<PartnerOfferPrices | null>(null);
    const [eligible, setEligible] = useState(false);
    const initialOffer = searchParams.get('offer');
    const [offerPeriod, setOfferPeriod] = useState<OfferPeriod>(isOfferPeriod(initialOffer) ? initialOffer : 'MONTHLY');
    // The offer asked for on the landing; dropped by "Continuer sans l'offre".
    const [wantsOffer, setWantsOffer] = useState<boolean>(isOfferPeriod(initialOffer));
    const codeInput = useRef<HTMLInputElement>(null);
    const offer = eligible ? prices : null; // the unlocked offer
    const lockedOffer = !eligible && wantsOffer && prices ? prices : null;
    const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

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
                // A partner code replaces the packs with the partner offer; failure just keeps the packs.
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

    const update = (field: 'ownerName' | 'ownerEmail' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!institutionType) { setError("Choisissez le type de votre établissement."); return; }
        const code = referralCode.trim();
        if (!code) { setError('Le code commercial est obligatoire.'); return; }
        if (codeStatus === 'invalid') { setError('Code commercial invalide.'); return; }
        setLoading(true);
        try {
            const { token, user, branch } = await signupSchool({
                ...form,
                referralCode: code,
                institutionType,
                ...(eligible && prices ? { offerPeriod } : packCode ? { packCode } : {}),
            });
            setAccessTokenState(token);
            setUser(user);
            setActiveBranchId(branch.id);
            router.push('/admin/settings');
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'Signup failed';
            if (msg === 'Invalid referral code' || msg === 'Referral code is required') {
                setCodeStatus('invalid');
                setError(msg === 'Invalid referral code' ? 'Code commercial invalide.' : 'Le code commercial est obligatoire.');
            } else if (msg === 'This offer is only available through a partner') {
                setEligible(false);
                setError("Cette offre n'est disponible que via un partenaire.");
            } else {
                setError(msg);
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
                        Smart<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">School</span>
                    </h2>
                    <div className="h-1.5 w-24 bg-indigo-500 rounded-full mx-auto mb-8 shadow-[0_0_20px_rgba(99,102,241,0.6)]"></div>
                    <p className="text-indigo-100/60 text-xl font-medium leading-relaxed">
                        Créez votre école en quelques minutes et pilotez votre établissement avec précision et élégance.
                    </p>
                </div>

                {/* Decorative Bottom Credits */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center text-white/20 text-[10px] font-black tracking-[0.4em] uppercase font-mono">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-[1px] bg-white/20"></div>
                        <span>Gestion Administrative v2.0</span>
                        <div className="w-8 h-[1px] bg-white/20"></div>
                    </div>
                </div>
            </div>

            {/* Right Column: Signup Form Container */}
            <div className="w-full lg:w-1/2 h-screen flex flex-col px-8 sm:px-16 lg:px-24 py-4 lg:py-8 bg-white relative z-10 border-l border-slate-50 shadow-[-50px_0_100px_-50px_rgba(0,0,0,0.05)] overflow-y-auto custom-scrollbar">
                <div className="max-w-md w-full mx-auto flex flex-col">

                    {/* Header */}
                    <div className="mb-6 lg:mb-8 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
                        <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-2 text-slate-900 leading-tight">
                            Créer votre <span className="text-indigo-600">école</span>
                        </h1>
                        <p className="text-slate-400 font-medium">Démarrez votre essai en créant votre premier établissement.</p>
                    </div>

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
                                Type de votre établissement
                            </label>
                            <select
                                id="institutionType"
                                value={institutionType}
                                onChange={(e) => setInstitutionType(e.target.value as InstitutionType | '')}
                                required
                                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:outline-none font-bold text-lg shadow-sm"
                            >
                                <option value="">Choisir…</option>
                                {INSTITUTION_TYPES.map((type) => (
                                    <option key={type} value={type}>
                                        {INSTITUTION_TYPE_LABELS[type]}
                                    </option>
                                ))}
                            </select>

                            {lockedOffer && (
                                <div className="grid gap-2" role="radiogroup" aria-label="Offre partenaire (verrouillée)">
                                    <p className="text-xs font-extrabold uppercase tracking-wider text-amber-600">Offre spéciale via Partenaire</p>
                                    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                                        {codeStatus === 'valid' || codeStatus === 'invalid'
                                            ? codeStatus === 'valid'
                                                ? "Ce code n'est pas celui d'un partenaire : l'offre spéciale nécessite le code de votre partenaire (commercial)."
                                                : "Code introuvable : l'offre spéciale nécessite le code de votre partenaire (commercial)."
                                            : 'Entrez le code de votre partenaire (commercial) pour bénéficier de cette offre.'}
                                        {(codeStatus === 'valid' || codeStatus === 'invalid') && (
                                            <button
                                                type="button"
                                                onClick={() => setWantsOffer(false)}
                                                className="mt-2 block rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700"
                                            >
                                                Continuer sans l&apos;offre
                                            </button>
                                        )}
                                    </div>
                                    {OFFER_PERIODS.map((period) => (
                                        <label
                                            key={period}
                                            className={`flex cursor-not-allowed items-center justify-between rounded-2xl border-2 px-5 py-3 ${
                                                offerPeriod === period ? 'border-amber-500 bg-amber-50/70' : 'border-slate-100 bg-slate-50 opacity-50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-3 font-bold text-slate-800">
                                                <input type="radio" name="offer-locked" disabled checked={offerPeriod === period} readOnly />
                                                {OFFER_LABELS[period]}
                                                {offerPeriod === period && <Lock size={14} className="text-amber-600" aria-label="Verrouillée" />}
                                            </span>
                                            <span className="text-right text-sm font-semibold text-slate-500">
                                                {formatOfferMoney(offerPrice(lockedOffer, period))} MAD
                                                {period !== 'MONTHLY' && (
                                                    <span className="block text-xs font-normal">
                                                        ≈ {formatOfferMoney(offerPerMonth(lockedOffer, period))} MAD / mois
                                                    </span>
                                                )}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {offer && (
                                <div className="grid gap-2" role="radiogroup" aria-label="Offre partenaire">
                                    <p className="text-xs font-extrabold uppercase tracking-wider text-amber-600">Offre partenaire</p>
                                    {OFFER_PERIODS.map((period) => (
                                        <label
                                            key={period}
                                            className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 px-5 py-3 ${
                                                offerPeriod === period ? 'border-amber-500 bg-amber-50' : 'border-slate-100 bg-slate-50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-3 font-bold text-slate-800">
                                                <input
                                                    type="radio"
                                                    name="offer"
                                                    value={period}
                                                    checked={offerPeriod === period}
                                                    onChange={() => setOfferPeriod(period)}
                                                />
                                                {OFFER_LABELS[period]}
                                            </span>
                                            <span className="text-right text-sm font-semibold text-slate-500">
                                                {formatOfferMoney(offerPrice(offer, period))} MAD
                                                {period !== 'MONTHLY' && (
                                                    <span className="block text-xs font-normal">
                                                        ≈ {formatOfferMoney(offerPerMonth(offer, period))} MAD / mois
                                                    </span>
                                                )}
                                            </span>
                                        </label>
                                    ))}
                                    <p className="text-xs text-slate-400">15 jours d&apos;essai gratuit, sans carte bancaire.</p>
                                </div>
                            )}

                            {!offer && !lockedOffer && packs.length > 0 && (
                                <div className="grid gap-2" role="radiogroup" aria-label="Pack">
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
                                                        Recommandé
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-sm font-semibold text-slate-500">
                                                {pack.monthlyPrice} MAD / mois
                                            </span>
                                        </label>
                                    ))}
                                    <p className="text-xs text-slate-400">15 jours d&apos;essai gratuit, sans carte bancaire.</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-600" htmlFor="referralCode">
                                Code commercial
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
                                onBlur={() => verifyCode(referralCode.trim())}
                                required
                                autoComplete="off"
                                placeholder="Ex. YOUSSEF22"
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
                            {codeStatus === 'checking' && <p className="text-xs text-slate-400">Vérification…</p>}
                            {codeStatus === 'valid' && <p className="text-xs font-semibold text-emerald-600">Code valide ✓</p>}
                            {codeStatus === 'invalid' && (
                                <p className="text-xs font-semibold text-red-600">Ce code n&apos;existe pas ou n&apos;est plus actif.</p>
                            )}
                            <a
                                href={whatsappUrl()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-xs font-bold text-emerald-700 hover:underline"
                            >
                                Pas de code ? Contactez-nous sur WhatsApp
                            </a>
                        </div>

                        <Input
                            type="text"
                            value={form.ownerName}
                            onChange={update('ownerName')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Votre nom"
                        />

                        <Input
                            type="email"
                            value={form.ownerEmail}
                            onChange={update('ownerEmail')}
                            required
                            autoComplete="off"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Adresse e-mail"
                        />

                        <Input
                            type="password"
                            value={form.password}
                            onChange={update('password')}
                            required
                            minLength={8}
                            autoComplete="new-password"
                            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 transition-all duration-300 placeholder:text-slate-400 font-bold text-lg shadow-sm"
                            placeholder="Mot de passe (8 caractères min.)"
                        />

                        <div className="pt-4 lg:pt-6">
                            <Button isLoading={loading} disabled={loading} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black text-xl shadow-[0_20px_45px_-10px_rgba(79,70,229,0.4)] transform active:scale-[0.97] transition-all duration-300 flex items-center justify-center gap-4 group">
                                {loading ? 'Création…' : 'Créer mon compte'}
                                {!loading && (
                                    <svg className="w-6 h-6 transform group-hover:translate-x-1.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                Déjà un compte ?{' '}
                                <a href="/login" className="text-indigo-600 hover:underline font-bold">Se connecter</a>
                            </span>
                            <div className="flex items-center justify-center gap-2">
                                <span>📧 Email :</span>
                                <a href="mailto:contact@smartecole.com" className="text-indigo-600 hover:underline font-bold">contact@smartecole.com</a>
                            </div>
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
        <Suspense fallback={null}>
            <SignupForm />
        </Suspense>
    );
}
