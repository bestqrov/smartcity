'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, X } from 'lucide-react';

export interface QrCardData {
    id: string;
    parentName: string;
    childrenNames: string[];
    url: string;
}

interface Props {
    schoolName: string;
    cards: QrCardData[];
    onClose: () => void;
}

const PER_PAGE = 8;

export default function QrCardsPrint({ schoolName, cards, onClose }: Props) {
    const [qrs, setQrs] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;
        Promise.all(
            cards.map(async (c) => [c.id, await QRCode.toDataURL(c.url, { width: 300, margin: 1 })] as const)
        )
            .then((pairs) => {
                if (!cancelled) setQrs(Object.fromEntries(pairs));
            })
            .catch((err) => console.error('[QrCardsPrint] QR generation failed:', err));
        return () => {
            cancelled = true;
        };
    }, [cards]);

    const pages: QrCardData[][] = [];
    for (let i = 0; i < cards.length; i += PER_PAGE) pages.push(cards.slice(i, i + PER_PAGE));
    const ready = Object.keys(qrs).length === cards.length;

    return (
        <div className="qr-print-root fixed inset-0 z-[100] overflow-auto bg-slate-100 dark:bg-slate-900">
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 8mm; }
                    body * { visibility: hidden !important; }
                    .qr-print-root, .qr-print-root * { visibility: visible !important; }
                    .qr-print-root { position: absolute !important; inset: 0 !important; overflow: visible !important; background: #fff !important; }
                    .qr-no-print { display: none !important; }
                    .qr-page { box-shadow: none !important; margin: 0 !important; width: auto !important; height: 279mm !important; padding: 0 !important; break-after: page; page-break-after: always; }
                    .qr-page:last-child { break-after: auto; page-break-after: auto; }
                }
            `}</style>
            <div className="qr-no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {cards.length} carte{cards.length > 1 ? 's' : ''} QR · {pages.length} page{pages.length > 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={() => window.print()}
                        disabled={!ready}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Printer size={16} /> {ready ? 'Imprimer' : 'Préparation…'}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                        <X size={16} /> Fermer
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto p-4">
                {pages.map((page, pi) => (
                    <div
                        key={pi}
                        className="qr-page mx-auto mb-6 grid w-[210mm] grid-cols-2 grid-rows-4 gap-[4mm] bg-white p-[8mm] text-black shadow-lg"
                        style={{ height: '297mm' }}
                    >
                        {page.map((c) => (
                            <div
                                key={c.id}
                                className="flex flex-col items-center justify-between overflow-hidden rounded-lg border border-dashed border-slate-400 p-[3mm] text-center"
                            >
                                <p className="w-full truncate text-[11px] font-bold uppercase tracking-wide text-slate-600">{schoolName}</p>
                                <p className="w-full truncate text-sm font-bold">{c.parentName}</p>
                                {c.childrenNames.length > 0 && (
                                    <p className="w-full truncate text-[10px] text-slate-600">{c.childrenNames.join(', ')}</p>
                                )}
                                {qrs[c.id] ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={qrs[c.id]} alt="" className="h-[32mm] w-[32mm]" />
                                ) : (
                                    <div className="h-[32mm] w-[32mm] bg-slate-100" />
                                )}
                                <p className="w-full break-all text-[8px] leading-tight text-slate-500">{c.url}</p>
                                <p className="text-[10px] font-medium leading-tight">Scannez ce code pour suivre votre enfant</p>
                                <p dir="rtl" className="text-[10px] font-medium leading-tight">سكانيو هاد الكود باش تتبعو وليدكم</p>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
