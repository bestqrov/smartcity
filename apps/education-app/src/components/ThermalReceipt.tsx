'use client';

interface ThermalReceiptProps {
  tenantName: string;
  receiptId: string;
  date: string;
  studentName: string;
  itemLabel: string;
  method: string;
  amount: number;
  thankYouLabel: string;
  receiptLabel: string;
  dateLabel: string;
  studentLabel: string;
  itemFieldLabel: string;
  methodLabel: string;
}

export function ThermalReceipt({
  tenantName,
  receiptId,
  date,
  studentName,
  itemLabel,
  method,
  amount,
  thankYouLabel,
  receiptLabel,
  dateLabel,
  studentLabel,
  itemFieldLabel,
  methodLabel,
}: ThermalReceiptProps) {
  return (
    <div
      id="thermal-receipt"
      style={{ width: 384, padding: 8, fontFamily: 'monospace', color: '#000', background: '#fff' }}
    >
      <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{tenantName}</div>
      <div style={{ marginTop: 8 }}>{receiptLabel}: {receiptId}</div>
      <div>{dateLabel}: {date}</div>
      <div>{studentLabel}: {studentName}</div>
      <div>{itemFieldLabel}: {itemLabel}</div>
      <div>{methodLabel}: {method}</div>
      <div style={{ marginTop: 8, fontWeight: 'bold' }}>Montant: {amount} MAD</div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>--- {thankYouLabel} ---</div>
    </div>
  );
}
