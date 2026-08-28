import React from 'react';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';

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
    const { profile } = useSchoolProfile();
    const currentDate = new Date().toLocaleDateString('fr-FR');
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
                    {profile?.schoolName || 'Smart School'}
                </div>
                {profile?.address && (
                    <div style={{ fontSize: '10px', marginBottom: '2px' }}>
                        {profile.address}
                    </div>
                )}
                <div style={{ fontSize: '10px' }}>
                    Tél: +212 608 18 38 86
                </div>
            </div>

            {/* Title */}
            <div style={{
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                marginBottom: '15px',
                marginTop: '15px'
            }}>
                Reçu Soutien
            </div>

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
                <span>Date: {currentDate}</span>
                <span>Reçu No: {receiptNo}</span>
            </div>

            {/* Another dotted line */}
            <div style={{
                borderTop: '1px dashed #000',
                marginBottom: '10px'
            }}></div>

            {/* Client Info */}
            <div style={{ marginBottom: '10px', fontSize: '11px' }}>
                <div>Client: {studentName} {studentSurname}</div>
                <div>Tél: {phone}</div>
                <div>Paiement: {paymentMethod}</div>
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
                <span>Description</span>
                <span>Montant</span>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '10px', fontSize: '11px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '5px'
                }}>
                    <span>May Tuition Fee</span>
                    <span>{subjectsTotal.toFixed(2)} MAD</span>
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
                    <span style={{ marginRight: '10px' }}>Total:</span>
                    <span style={{ fontWeight: 'bold' }}>{total.toFixed(2)} MAD</span>
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginBottom: '3px'
                }}>
                    <span style={{ marginRight: '10px' }}>Payé:</span>
                    <span style={{ fontWeight: 'bold' }}>{total.toFixed(2)} MAD</span>
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end'
                }}>
                    <span style={{ marginRight: '10px' }}>Reste:</span>
                    <span style={{ fontWeight: 'bold' }}>0,00 MAD</span>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                textAlign: 'center',
                marginTop: '20px',
                fontSize: '11px'
            }}>
                Merci pour votre visite!
            </div>

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
