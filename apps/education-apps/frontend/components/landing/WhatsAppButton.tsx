import { whatsappUrl } from '@/lib/landing/whatsapp';

export default function WhatsAppButton({ label }: { label: string }) {
    return (
        <a
            href={whatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-5 end-5 z-30 rounded-full bg-green-500 px-5 py-3 font-bold text-white shadow-lg shadow-green-500/40"
        >
            💬 {label}
        </a>
    );
}
