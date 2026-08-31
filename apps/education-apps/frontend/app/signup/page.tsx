'use client';
import React, { useState } from 'react';
import Input from '../../components/Input';
import Button from '../../components/Button';
import useAuthStore, { setActiveBranchId } from '../../store/useAuthStore';
import { useRouter } from 'next/navigation';
import { signupSchool, SignupSchoolData } from '../../lib/services/schools';
import { GraduationCap, X } from 'lucide-react';

export default function SignupPage() {
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);
    const setAccessTokenState = useAuthStore((state) => state.setAccessToken);

    const [form, setForm] = useState<SignupSchoolData>({
        ownerName: '',
        ownerEmail: '',
        password: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const update = (field: keyof SignupSchoolData) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const { token, user, branch } = await signupSchool(form);
            setAccessTokenState(token);
            setUser(user);
            setActiveBranchId(branch.id);
            router.push('/admin/settings');
        } catch (err: any) {
            const msg = err.response?.data?.error || err.response?.data?.message || 'Signup failed';
            setError(msg);
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
