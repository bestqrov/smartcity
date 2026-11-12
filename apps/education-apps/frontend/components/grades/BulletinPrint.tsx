'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Bulletin, BulletinRow } from '@/lib/services/grades';
import { fixed2 } from './utils';

interface Props {
    bulletin: Bulletin;
    rows: BulletinRow[];
    groupName: string;
    schoolName: string;
    logo?: string | null;
    academicYear?: string | null;
    /** subject → coefficient, only when every subject's coefficient is uniform. */
    coefficients: Record<string, number> | null;
    onDone: () => void;
}

const PRINT_CSS = `
@media print {
  body > *:not(#bulletin-print-root) { display: none !important; }
  #bulletin-print-root { display: block !important; }
  @page { size: A4 portrait; margin: 14mm; }
  .bulletin-page { page-break-after: always; break-after: page; }
  .bulletin-page:last-child { page-break-after: auto; break-after: auto; }
}
@media screen {
  #bulletin-print-root { position: fixed; inset: 0; z-index: 9999; overflow: auto; background: #e2e8f0; padding: 16px; }
  .bulletin-page { max-width: 210mm; margin: 0 auto 16px; background: #fff; padding: 14mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
}
#bulletin-print-root { color: #0f172a; font-family: system-ui, sans-serif; }
#bulletin-print-root table { width: 100%; border-collapse: collapse; font-size: 12px; }
#bulletin-print-root th, #bulletin-print-root td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; }
#bulletin-print-root th { background: #f1f5f9; }
`;

/** Printable report cards, one A4 page per student; the user saves them as PDF from the print dialog. */
export default function BulletinPrint({ bulletin, rows, groupName, schoolName, logo, academicYear, coefficients, onDone }: Props) {
    useEffect(() => {
        const after = () => onDone();
        window.addEventListener('afterprint', after);
        const t = setTimeout(() => window.print(), 300); // let the logo load
        return () => {
            clearTimeout(t);
            window.removeEventListener('afterprint', after);
        };
    }, [onDone]);

    const n = bulletin.rows.length;

    return createPortal(
        <div id="bulletin-print-root">
            <style>{PRINT_CSS}</style>
            <div className="mb-3 flex justify-center gap-2 print:hidden">
                <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                    Imprimer / PDF
                </button>
                <button type="button" onClick={onDone} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    Fermer
                </button>
            </div>
            {rows.map((row) => (
                <section key={row.studentId} className="bulletin-page">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #0f172a', paddingBottom: 10 }}>
                        {logo && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logo} alt="" style={{ height: 56, width: 56, objectFit: 'contain' }} />
                        )}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{schoolName}</div>
                            {academicYear && <div style={{ fontSize: 12 }}>Année scolaire {academicYear}</div>}
                        </div>
                    </div>
                    <h1 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, margin: '18px 0 4px' }}>Bulletin de notes</h1>
                    <p style={{ textAlign: 'center', fontSize: 14, marginBottom: 16 }}>{bulletin.period}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
                        <div>
                            Élève : <strong>{row.surname} {row.name}</strong>
                        </div>
                        <div>
                            Groupe : <strong>{groupName}</strong>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Matière</th>
                                {coefficients && <th style={{ width: 50 }}>Coef</th>}
                                <th style={{ width: 90 }}>Moyenne /20</th>
                                <th style={{ width: '40%' }}>Appréciation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bulletin.subjects.map((s) => (
                                <tr key={s}>
                                    <td>{s}</td>
                                    {coefficients && <td>{String(coefficients[s] ?? '').replace('.', ',')}</td>}
                                    <td>{fixed2(row.averages[s])}</td>
                                    <td style={{ height: 28 }} />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div style={{ display: 'flex', gap: 24, fontSize: 14, margin: '14px 0' }}>
                        <div>
                            Moyenne générale : <strong>{fixed2(row.general)}</strong> / 20
                        </div>
                        <div>
                            Rang : <strong>{row.rank ?? '—'} / {n}</strong>
                        </div>
                    </div>
                    <div style={{ border: '1px solid #94a3b8', minHeight: 90, padding: 8, fontSize: 12 }}>Observation générale</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                        <div style={{ width: 220, minHeight: 90, border: '1px dashed #94a3b8', padding: 8, fontSize: 12 }}>Signature et cachet</div>
                    </div>
                </section>
            ))}
        </div>,
        document.body,
    );
}
