import { whatsappUrl } from '../../lib/landing/whatsapp';

/** Owner phone with one-tap call and WhatsApp links; a dash when the school has none (older signups). */
export default function PhoneContact({ phone, className = '' }: { phone?: string | null; className?: string }) {
    const value = phone?.trim();
    if (!value) return <span className={className}>—</span>;
    return (
        <span className={`inline-flex items-center gap-2 whitespace-nowrap ${className}`} dir="ltr">
            <a href={`tel:${value.replace(/[^\d+]/g, '')}`} className="tabular-nums hover:underline">
                {value}
            </a>
            <a
                href={whatsappUrl(value)}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp"
                aria-label="WhatsApp"
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
                WhatsApp
            </a>
        </span>
    );
}
