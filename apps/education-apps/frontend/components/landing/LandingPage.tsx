'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/store/useAuthStore';
import { messages } from '@/lib/landing/messages';
import { useLandingLang } from '@/lib/landing/useLandingLang';
import { DEFAULT_INSTITUTION_TYPE, isInstitutionType, type InstitutionType } from '@/lib/institutionTypes';
import LandingNav from './LandingNav';
import Hero from './Hero';
import FeaturesSection from './FeaturesSection';
import TypesSection from './TypesSection';
import PricingSection from './PricingSection';
import StepsAndCta from './StepsAndCta';
import WhatsAppButton from './WhatsAppButton';

const TYPE_STORAGE_KEY = 'landing-type';

export default function LandingPage() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const [lang, setLang] = useLandingLang();
    const [type, setType] = useState<InstitutionType>(DEFAULT_INSTITUTION_TYPE);
    const [refCode, setRefCode] = useState('');

    // A commercial's link may point to the landing (/?ref=CODE): keep the code for the signup links.
    useEffect(() => {
        const ref = new URLSearchParams(window.location.search).get('ref');
        if (ref) setRefCode(ref.trim().toUpperCase());
    }, []);
    const m = messages[lang];

    // Already signed in: go to the role's home, like the login page does.
    useEffect(() => {
        if (!user) return;
        if (user.role === 'OWNER') router.replace('/admin/select-branch');
        else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') router.replace('/admin');
        else if (user.role === 'SECRETARY') router.replace('/secretary');
        else if (user.role === 'SALES_AGENT') router.replace('/agent');
    }, [user, router]);

    // Remember the chosen institution type.
    useEffect(() => {
        try {
            const saved = localStorage.getItem(TYPE_STORAGE_KEY);
            if (isInstitutionType(saved)) setType(saved);
        } catch {
            // storage unavailable
        }
    }, []);

    const changeType = (next: InstitutionType) => {
        setType(next);
        try {
            localStorage.setItem(TYPE_STORAGE_KEY, next);
        } catch {
            // ignore
        }
    };

    const pickType = (next: InstitutionType | null) => {
        if (next) changeType(next);
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            lang={lang}
            className="min-h-screen bg-[#0b1020] text-slate-100"
            style={{ fontFamily: lang === 'ar' ? 'Cairo, Inter, sans-serif' : 'Inter, Cairo, sans-serif' }}
        >
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&family=Inter:wght@400;600;800&display=swap"
            />
            <LandingNav m={m} lang={lang} onLangChange={setLang} />
            <Hero m={m} />
            <FeaturesSection m={m} />
            <TypesSection m={m} onPick={pickType} />
            <PricingSection m={m} type={type} onTypeChange={changeType} refCode={refCode} />
            <StepsAndCta m={m} />
            <WhatsAppButton label={m.wa_label} />
        </div>
    );
}
