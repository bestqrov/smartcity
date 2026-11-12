import { whatsappUrl } from '@/lib/landing/whatsapp';

export default function WhatsAppButton({ label }: { label: string }) {
    return (
        <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-4 end-4 z-30 rounded-full bg-green-500 px-4 py-3 text-sm sm:bottom-5 sm:end-5 sm:px-5 sm:text-base font-bold text-white shadow-lg shadow-green-500/40"
        >
            💬 {label}
        </a>
    );
}
