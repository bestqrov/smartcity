import React from 'react';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';

import { appLocale, useI18n } from '@/lib/i18n/I18nProvider';
interface PrintReceiptProps {
    studentName: string;
    studentSurname: string;
    phone: string;
    inscriptionFee: number;
    subjectsTotal: number;
    total: number;
    paymentMethod?: string;
    receiptNumber?: string;
}

export const PrintReceipt: React.FC<PrintReceiptProps> = ({
    studentName,
    studentSurname,
    phone,
    inscriptionFee,
    subjectsTotal,
    total,
    paymentMethod = 'Cash',
    receiptNumber,
}) => {
    const { tr } = useI18n();
    const { profile } = useSchoolProfile();
    const currentDate = new Date().toLocaleDateString(appLocale());
    const receiptNo = receiptNumber || `RCPT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

    return (
        <div className="receipt-container" style={{
            width: '80mm',
            fontFamily: 'monospace',
            fontSize: '12px',
            padding: '10mm',
            margin: '0 auto',
            backgroundColor: 'white',
        }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                    {profile?.schoolName || tr("ArwaEduc")}
                </div>
                {profile?.address && (
                    <div style={{ fontSize: '10px', marginBottom: '2px' }}>
                        {profile.address}
                    </div>
                )}
                <div style={{ fontSize: '10px' }}>{tr("Tél: +212 608 18 38 86")}</div>
            </div>

            {/* Title */}
            <div style={{
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '15px',
                marginTop: '15px'
            }}>{tr("Reçu Soutien")}</div>

            {/* Dotted line */}
            <div style={{
                borderTop: '1px dashed #000',
                marginBottom: '10px'
            }}></div>

            {/* Date and Receipt Number */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '10px',
                fontSize: '11px'
            }}>
                <span>{tr("Date:")}{' '}{currentDate}</span>
                <span>{tr("Reçu No:")}{' '}{receiptNo}</span>
            </div>

            {/* Another dotted line */}
            <div style={{
                borderTop: '1px dashed #000',
                marginBottom: '10px'
            }}></div>

            {/* Client Info */}
            <div style={{ marginBottom: '10px', fontSize: '11px' }}>
                <div>{tr("Client:")}{' '}{studentName} {studentSurname}</div>
                <div>{tr("Tél:")}{' '}{phone}</div>
                <div>{tr("Paiement:")}{' '}{paymentMethod}</div>
            </div>

            {/* Dotted line */}
            <div style={{
                borderTop: '1px dashed #000',
                marginBottom: '10px'
            }}></div>

            {/* Description Table Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 'bold',
                marginBottom: '8px',
                fontSize: '11px'
            }}>
                <span>{tr("Description")}</span>
                <span>{tr("Montant")}</span>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '10px', fontSize: '11px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '5px'
                }}>
                    <span>{tr("May Tuition Fee")}</span>
                    <span>{subjectsTotal.toFixed(2)}{' '}{tr("MAD")}</span>
                </div>
            </div>

            {/* Dotted line */}
            <div style={{
                borderTop: '1px dashed #000',
                marginBottom: '10px'
            }}></div>

            {/* Totals */}
            <div style={{ fontSize: '11px', marginBottom: '15px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: '3px'
                }}>
                    <span style={{ marginRight: '10px' }}>{tr("Total:")}</span>
                    <span style={{ fontWeight: 'bold' }}>{total.toFixed(2)}{' '}{tr("MAD")}</span>
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: '3px'
                }}>
                    <span style={{ marginRight: '10px' }}>{tr("Payé:")}</span>
                    <span style={{ fontWeight: 'bold' }}>{total.toFixed(2)}{' '}{tr("MAD")}</span>
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <span style={{ marginRight: '10px' }}>{tr("Reste:")}</span>
                    <span style={{ fontWeight: 'bold' }}>{tr("0,00 MAD")}</span>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                textAlign: 'center',
                marginTop: '20px',
                fontSize: '11px'
            }}>{tr("Merci pour votre visite!")}</div>

            <style jsx>{`
                @media print {
                    body {
                        margin: 0;
                        padding: 0;
                    }
                    .receipt-container {
                        width: 80mm !important;
                        margin: 0 !important;
                        padding: 10mm !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default PrintReceipt;
