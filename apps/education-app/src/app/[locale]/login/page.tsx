'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button, Input } from '@smartcity/ui';
import { GraduationCap, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'fr';
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push(`/${locale}/branches`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('common.error');
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      {/* Left: branded panel */}
      <div className="relative hidden shrink-0 items-center justify-center overflow-hidden bg-slate-900 p-12 lg:flex lg:w-1/2">
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-900 via-slate-900 to-primary-900" />
        <div className="absolute -right-24 -top-24 z-0 h-96 w-96 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 z-0 h-96 w-96 rounded-full bg-primary-400/10 blur-3xl" />

        <div className="animate-fade-in relative z-10 max-w-lg px-8 text-center">
          <div className="mb-8 flex justify-center">
            <div className="rounded-[40px] border border-white/10 bg-white/5 p-5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <GraduationCap size={64} className="text-white" />
            </div>
          </div>
          <h1 className="mb-6 text-5xl font-black leading-[1.1] tracking-tight text-white">
            SmartCity{' '}
            <span className="bg-gradient-to-r from-primary-300 to-primary-500 bg-clip-text text-transparent">
              {t('education.brandName')}
            </span>
          </h1>
          <div className="mx-auto mb-8 h-1.5 w-24 rounded-full bg-primary-500 shadow-[0_0_20px_rgba(16,185,129,0.6)]" />
          <p className="text-xl font-medium leading-relaxed text-primary-100/70">
            {t('education.brandTagline')}
          </p>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex w-full flex-1 items-center justify-center px-8 py-16 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="animate-slide-in-top mb-10">
            <h2 className="text-4xl font-black tracking-tight text-slate-900">
              {t('education.loginPrefix')}{' '}
              <span className="text-primary-600">{t('education.loginHeading')}</span>
            </h2>
          </div>

          <form
            onSubmit={handleSubmit}
            className="animate-slide-in-bottom animation-delay-150 flex flex-col gap-5"
          >
            <Input
              label={t('auth.email')}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              size="lg"
            />
            <Input
              label={t('auth.password')}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              size="lg"
            />

            {error && (
              <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                <div className="rounded-xl bg-red-100 p-1.5">
                  <X size={16} className="text-red-700" />
                </div>
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              loading={isSubmitting}
              size="lg"
              className="group mt-2 w-full rounded-xl bg-primary-600 py-4 text-lg font-bold shadow-[0_20px_45px_-10px_rgba(5,150,105,0.4)] hover:bg-primary-700"
              iconRight={
                <ArrowRight
                  size={20}
                  className="transition-transform group-hover:translate-x-1"
                />
              }
            >
              {t('common.login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
