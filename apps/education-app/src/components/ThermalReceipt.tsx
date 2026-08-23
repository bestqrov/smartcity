'use client';

interface ThermalReceiptProps {
  tenantName: string;
  receiptId: string;
  date: string;
  studentName: string;
  offeringName: string;
  method: string;
  amount: number;
  thankYouLabel: string;
}

export function ThermalReceipt({
  tenantName,
  receiptId,
  date,
  studentName,
  offeringName,
  method,
  amount,
  thankYouLabel,
}: ThermalReceiptProps) {
  return (
    <div
      id="thermal-receipt"
      style={{ width: 384, padding: 8, fontFamily: 'monospace', color: '#000', background: '#fff' }}
    >
      <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{tenantName}</div>
      <div style={{ marginTop: 8 }}>Reçu: {receiptId}</div>
      <div>Date: {date}</div>
      <div>Étudiant: {studentName}</div>
      <div>Offre: {offeringName}</div>
      <div>Méthode: {method}</div>
      <div style={{ marginTop: 8, fontWeight: 'bold' }}>Montant: {amount} MAD</div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>--- {thankYouLabel} ---</div>
    </div>
  );
}
