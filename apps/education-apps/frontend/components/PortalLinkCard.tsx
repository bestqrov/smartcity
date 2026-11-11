'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, MessageCircle } from 'lucide-react';
import { whatsappNumber } from '@/lib/publicUrl';

interface PortalLinkCardProps {
    title: string;
    url: string;
    /** Phone to pre-fill the WhatsApp share with; without it WhatsApp asks who to send to. */
    phone?: string | null;
    /** Text sent before the link in the WhatsApp message. */
    message: string;
    warning?: string;
}

/** QR code + the link itself, with copy / open / send-by-WhatsApp actions. */
export default function PortalLinkCard({ title, url, phone, message, warning }: PortalLinkCardProps) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;
        QRCode.toDataURL(url, { width: 220, margin: 1 })
            .then((generated) => !cancelled && setDataUrl(generated))
            .catch(() => !cancelled && setDataUrl(null));
        return () => {
            cancelled = true;
        };
    }, [url]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // Clipboard API unavailable (http on a LAN IP): fall back to a hidden textarea.
            const area = document.createElement('textarea');
            area.value = url;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const number = whatsappNumber(phone);
    const waHref = `https://wa.me/${number || ''}?text=${encodeURIComponent(`${message}\n${url}`)}`;

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4">
            <div>
                <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
                {warning && <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{warning}</p>}
            </div>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="flex h-[220px] w-[220px] shrink-0 items-center justify-center rounded-xl bg-white p-2">
                    {dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dataUrl} alt={`QR code — ${title}`} width={204} height={204} />
                    ) : (
                        <span className="text-sm text-slate-400">QR…</span>
                    )}
                </div>

                <div className="w-full min-w-0 space-y-3">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-300 break-all select-all">
                        {url}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={copy}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                            {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                            {copied ? 'Copié' : 'Copier le lien'}
                        </button>
                        <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                            <MessageCircle size={16} /> Envoyer par WhatsApp
                        </a>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                        >
                            <ExternalLink size={16} /> Ouvrir
                        </a>
                    </div>
                    {!number && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Aucun numéro enregistré : WhatsApp vous demandera le destinataire.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
