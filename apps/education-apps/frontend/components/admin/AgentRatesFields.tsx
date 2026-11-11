'use client';

import PackRatesEditor, { toPackRateRows, toPackRates, type PackRateRow } from './PackRatesEditor';
import { BASE_RATE_FIELDS, PERIOD_LABELS } from '@/lib/salesAgentLabels';
import type { AdminPack } from '@/lib/services/packs';
import type { AgentRates, BaseRatesInput } from '@/lib/services/salesAgents';

export interface RatesForm {
    monthlyRate: string;
    semiannualRate: string;
    yearlyRate: string;
    packRates: PackRateRow[];
}

export const emptyRatesForm: RatesForm = { monthlyRate: '10', semiannualRate: '10', yearlyRate: '10', packRates: [] };

export const ratesFormFrom = (rates: AgentRates): RatesForm => ({
    monthlyRate: String(rates.monthlyRate),
    semiannualRate: String(rates.semiannualRate),
    yearlyRate: String(rates.yearlyRate),
    packRates: toPackRateRows(rates.packRates),
});

export const ratesPayload = (form: RatesForm): BaseRatesInput => ({
    monthlyRate: Number(form.monthlyRate),
    semiannualRate: Number(form.semiannualRate),
    yearlyRate: Number(form.yearlyRate),
    packRates: toPackRates(form.packRates),
});

interface Props {
    value: RatesForm;
    onChange: (value: RatesForm) => void;
    packs: AdminPack[];
    disabled?: boolean;
}

export default function AgentRatesFields({ value, onChange, packs, disabled }: Props) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                {BASE_RATE_FIELDS.map((field) => (
                    <label key={field.key} className="block text-sm text-gray-600">
                        {PERIOD_LABELS[field.period]} (%)
                        <input
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg disabled:bg-gray-50"
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            value={value[field.key]}
                            onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
                            disabled={disabled}
                            required
                        />
                    </label>
                ))}
            </div>
            <PackRatesEditor
                packs={packs}
                rows={value.packRates}
                onChange={(packRates) => onChange({ ...value, packRates })}
                disabled={disabled}
            />
        </div>
    );
}
