'use client';

import { useEffect, useState } from 'react';
import { DashboardBanner } from '@/components/dashboard/DashboardShell';
import { apiErrorMessage } from '@/lib/services/packs';
import { usePlatformPrefs } from '@/lib/platform/prefs';
import { localizeApiError } from '@/lib/agent/messages';
import {
    SIGNUP_PERIODS,
    getPlatformSettings,
    updatePlatformSettings,
    type PlatformSettings,
    type SignupPeriod,
} from '@/lib/services/platformSettings';

const cardClass = 'space-y-4 rounded-2xl border border-espresso-100 bg-white p-5 shadow-sm dark:border-espresso-800 dark:bg-espresso-900';
const titleClass = 'text-base font-extrabold text-espresso-800 dark:text-espresso-50';
const labelClass = 'block text-sm font-semibold text-gray-700 dark:text-espresso-100';
const inputClass =
    'mt-1 w-full rounded-xl border border-espresso-100 bg-white px-3 py-2 text-sm text-gray-900 focus:border-espresso-500 focus:outline-none focus:ring-2 focus:ring-espresso-500/30 dark:border-espresso-700 dark:bg-espresso-950 dark:text-espresso-50';
const hintClass = 'text-xs text-gray-500 dark:text-espresso-300';

interface Form {
    trialDays: string;
    signupOpen: boolean;
    signupPeriods: SignupPeriod[];
    platformName: string;
    supportPhone: string;
    supportWhatsapp: string;
    supportEmail: string;
    bannerText: string;
    bannerActive: boolean;
}

const toForm = (s: PlatformSettings): Form => ({
    trialDays: String(s.trialDays),
    signupOpen: s.signupOpen,
    signupPeriods: s.signupPeriods,
    platformName: s.platformName,
    supportPhone: s.supportPhone ?? '',
    supportWhatsapp: s.supportWhatsapp ?? '',
    supportEmail: s.supportEmail ?? '',
    bannerText: s.bannerText ?? '',
    bannerActive: s.bannerActive,
});

export default function PlatformSettingsPage() {
    const { m } = usePlatformPrefs();
    const [form, setForm] = useState<Form | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getPlatformSettings()
            .then((s) => setForm(toForm(s)))
            .catch((err) => setError(apiErrorMessage(err)));
    }, []);

    if (!form)
        return error ? (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200">
                {localizeApiError(m, error)}
            </div>
        ) : (
            <p role="status" className="text-espresso-700 dark:text-espresso-200">
                {m.loading}
            </p>
        );

    const set = <K extends keyof Form>(key: K, value: Form[K]) => {
        setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
        setNotice('');
    };
    const togglePeriod = (period: SignupPeriod) =>
        set('signupPeriods', form.signupPeriods.includes(period) ? form.signupPeriods.filter((p) => p !== period) : [...form.signupPeriods, period]);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setNotice('');
        const trialDays = Number(form.trialDays);
        if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90) return setError(m.ps_err_trial);
        if (form.signupPeriods.length === 0) return setError(m.ps_err_periods);
        if (form.bannerActive && !form.bannerText.trim()) return setError(m.ps_err_banner);
        setSaving(true);
        try {
            const saved = await updatePlatformSettings({
                trialDays,
                signupOpen: form.signupOpen,
                signupPeriods: form.signupPeriods,
                platformName: form.platformName,
                supportPhone: form.supportPhone,
                supportWhatsapp: form.supportWhatsapp,
                supportEmail: form.supportEmail,
                bannerText: form.bannerText,
                bannerActive: form.bannerActive,
            });
            setForm(toForm(saved));
            setNotice(m.ps_saved);
        } catch (err) {
            setError(apiErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={save} className="space-y-4">
            <DashboardBanner title={m.ps_title} subtitle={m.ps_sub} />

            <div className="grid gap-4 lg:grid-cols-2">
                <section className={cardClass} aria-labelledby="ps-signup">
                    <h2 id="ps-signup" className={titleClass}>{m.ps_signup_card}</h2>
                    <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-espresso-50">
                        <input type="checkbox" checked={form.signupOpen} onChange={(e) => set('signupOpen', e.target.checked)} className="h-4 w-4" />
                        {m.ps_signup_open}
                    </label>
                    <p className={hintClass}>{m.ps_signup_closed_hint}</p>
                    <label className={labelClass}>
                        {m.ps_trial_days}
                        <input type="number" min={1} max={90} value={form.trialDays} onChange={(e) => set('trialDays', e.target.value)} className={inputClass} dir="ltr" />
                    </label>
                    <fieldset>
                        <legend className={labelClass}>{m.ps_periods}</legend>
                        <div className="mt-2 flex flex-wrap gap-3">
                            {SIGNUP_PERIODS.map((period) => (
                                <label key={period} className="flex items-center gap-2 text-sm text-gray-800 dark:text-espresso-50">
                                    <input type="checkbox" checked={form.signupPeriods.includes(period)} onChange={() => togglePeriod(period)} className="h-4 w-4" />
                                    {m.sa_decl_periods[period]}
                                </label>
                            ))}
                        </div>
                        <p className={`mt-1 ${hintClass}`}>{m.ps_periods_hint}</p>
                    </fieldset>
                </section>

                <section className={cardClass} aria-labelledby="ps-identity">
                    <h2 id="ps-identity" className={titleClass}>{m.ps_identity_card}</h2>
                    <label className={labelClass}>
                        {m.ps_platform_name}
                        <input value={form.platformName} onChange={(e) => set('platformName', e.target.value)} maxLength={60} required className={inputClass} />
                    </label>
                    <label className={labelClass}>
                        {m.ps_support_phone}
                        <input type="tel" value={form.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} className={inputClass} dir="ltr" />
                    </label>
                    <label className={labelClass}>
                        {m.ps_support_whatsapp}
                        <input type="tel" value={form.supportWhatsapp} onChange={(e) => set('supportWhatsapp', e.target.value)} className={inputClass} dir="ltr" />
                    </label>
                    <label className={labelClass}>
                        {m.ps_support_email}
                        <input type="email" value={form.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} className={inputClass} dir="ltr" />
                    </label>
                </section>

                <section className={`${cardClass} lg:col-span-2`} aria-labelledby="ps-banner">
                    <h2 id="ps-banner" className={titleClass}>{m.ps_banner_card}</h2>
                    <p className={hintClass}>{m.ps_banner_hint}</p>
                    <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-espresso-50">
                        <input type="checkbox" checked={form.bannerActive} onChange={(e) => set('bannerActive', e.target.checked)} className="h-4 w-4" />
                        {m.ps_banner_active}
                    </label>
                    <label className={labelClass}>
                        {m.ps_banner_text}
                        <textarea value={form.bannerText} onChange={(e) => set('bannerText', e.target.value)} maxLength={300} rows={3} className={inputClass} />
                    </label>
                </section>
            </div>

            {error && (
                <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200">
                    {localizeApiError(m, error)}
                </div>
            )}
            {notice && (
                <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-200">
                    {notice}
                </div>
            )}
            <div className="flex justify-end">
                <button type="submit" disabled={saving} className="rounded-full bg-espresso-800 px-6 py-2.5 text-sm font-bold text-white hover:bg-espresso-700 disabled:opacity-50 dark:bg-espresso-600">
                    {saving ? m.ps_saving : m.ps_save}
                </button>
            </div>
        </form>
    );
}
