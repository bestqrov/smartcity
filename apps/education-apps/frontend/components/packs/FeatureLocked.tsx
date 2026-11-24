'use client';

import { Lock, MessageCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { PACK_FEATURES, type PackFeature } from '@/lib/packs';
import { whatsappUrl } from '@/lib/landing/whatsapp';

// Shown instead of a page whose option is not checked on the school's pack.
export default function FeatureLocked({ feature, packName }: { feature: PackFeature; packName?: string | null }) {
    const { tr } = useI18n();
    const label = PACK_FEATURES.find((f) => f.key === feature)?.label ?? feature;
    const message = encodeURIComponent(`Bonjour, je souhaite ajouter l'option « ${label} » à mon pack ArwaEduc.`);
    return (
        <div className="mx-auto mt-10 max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-vib-card">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <Lock size={26} aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{tr('{feature} : option non incluse dans votre pack', { feature: tr(label) })}</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {packName ? tr('Votre pack actuel : {pack}.', { pack: packName }) + ' ' : ''}
                {tr('Contactez-nous pour ajouter cette option ou passer à un pack qui la contient.')}
            </p>
            <a
                href={`${whatsappUrl()}?text=${message}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
                <MessageCircle size={18} aria-hidden="true" /> {tr('Nous contacter sur WhatsApp')}
            </a>
        </div>
    );
}
