'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeCardProps {
    title: string;
    url: string;
}

export default function QrCodeCard({ title, url }: QrCodeCardProps) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setDataUrl(null);
        setError(false);
        QRCode.toDataURL(url, { width: 240 })
            .then((generated) => {
                if (!cancelled) setDataUrl(generated);
            })
            .catch((err) => {
                console.error('[QrCodeCard] failed to generate QR code:', err);
                if (!cancelled) setError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [url]);

    return (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-700">{title}</p>
            {error ? (
                <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-red-500">
                    Failed to generate QR code
                </div>
            ) : dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dataUrl} alt={`QR code for ${title}`} width={240} height={240} />
            ) : (
                <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-gray-400">
                    Generating…
                </div>
            )}
            <p className="max-w-[240px] break-all text-center text-xs text-gray-400">{url}</p>
        </div>
    );
}
