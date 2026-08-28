import React from 'react';
import { formatCurrency } from '../utils/format';

export default function ThermalReceipt({ receipt }: { receipt: any }) {
    return (
        <div style={{ width: 384, padding: 8, fontFamily: 'monospace' }}>
            <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{receipt.schoolName || 'School'}</div>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>{receipt.address || ''}</div>
            <div>Receipt: {receipt.id}</div>
            <div>Date: {new Date(receipt.date).toLocaleString()}</div>
            <div>Student: {receipt.studentName}</div>
            <div>Method: {receipt.method}</div>
            <div style={{ marginTop: 8, fontWeight: 'bold' }}>Amount: {formatCurrency(receipt.amount)}</div>
            <div style={{ marginTop: 12, textAlign: 'center' }}>--- شكرا ---</div>
        </div>
    );
}
