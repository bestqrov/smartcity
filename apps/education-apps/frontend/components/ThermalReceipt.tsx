import React from 'react';
import { formatCurrency } from '../utils/format';

import { useI18n } from '@/lib/i18n/I18nProvider';
export default function ThermalReceipt({ receipt }: { receipt: any }) {
    const { tr } = useI18n();
    return (
        <div style={{ width: 384, padding: 8, fontFamily: 'monospace' }}>
            <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{receipt.schoolName || tr("School")}</div>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>{receipt.address || ''}</div>
            <div>{tr("Receipt:")}{' '}{receipt.id}</div>
            <div>{tr("Date:")}{' '}{new Date(receipt.date).toLocaleString()}</div>
            <div>{tr("Student:")}{' '}{receipt.studentName}</div>
            <div>{tr("Method:")}{' '}{receipt.method}</div>
            <div style={{ marginTop: 8, fontWeight: 'bold' }}>{tr("Amount:")}{' '}{formatCurrency(receipt.amount)}</div>
            <div style={{ marginTop: 12, textAlign: 'center' }}>--- شكرا ---</div>
        </div>
    );
}
