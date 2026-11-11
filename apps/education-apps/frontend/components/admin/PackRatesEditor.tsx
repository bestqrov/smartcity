'use client';

import { Plus, Trash2 } from 'lucide-react';
import { INSTITUTION_TYPE_LABELS } from '@/lib/institutionTypes';
import { PERIODS, PERIOD_LABELS } from '@/lib/salesAgentLabels';
import type { AdminPack } from '@/lib/services/packs';
import type { PackRateInput, SubscriptionPeriod } from '@/lib/services/salesAgents';

// Form row: the rate stays a string while typing.
export interface PackRateRow {
    packId: string;
    period: SubscriptionPeriod;
    rate: string;
}

export const toPackRateRows = (rates: PackRateInput[]): PackRateRow[] =>
    rates.map((rate) => ({ packId: rate.packId, period: rate.period, rate: String(rate.rate) }));

export const toPackRates = (rows: PackRateRow[]): PackRateInput[] =>
    rows.map((row) => ({ packId: row.packId, period: row.period, rate: Number(row.rate) }));

interface Props {
    packs: AdminPack[];
    rows: PackRateRow[];
    onChange: (rows: PackRateRow[]) => void;
    disabled?: boolean;
}

// Pack names repeat across institution types ("Pro"), so the option names the types too.
const packOptionLabel = (pack: AdminPack): string =>
    `${pack.name} — ${pack.institutionTypes.map((type) => INSTITUTION_TYPE_LABELS[type]).join(', ')}${pack.active ? '' : ' (inactif)'}`;

export default function PackRatesEditor({ packs, rows, onChange, disabled }: Props) {
    const update = (index: number, patch: Partial<PackRateRow>) =>
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
    const add = () => onChange([...rows, { packId: '', period: 'YEARLY', rate: '' }]);
    const isDuplicate = (index: number) =>
        rows.some(
            (other, i) => i !== index && other.packId !== '' && other.packId === rows[index].packId && other.period === rows[index].period
        );

    const inputClass = 'px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50';

    return (
        <div className="space-y-2">
            <div className="text-sm text-gray-600">
                Exceptions par pack{' '}
                <span className="text-xs text-gray-400">(remplacent le taux de base pour ce pack et cette période)</span>
            </div>
            {rows.length === 0 && <p className="text-xs text-gray-400">Aucune exception.</p>}
            {rows.map((row, index) => (
                <div key={index} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            className={`${inputClass} flex-1 min-w-[12rem]`}
                            aria-label="Pack"
                            value={row.packId}
                            onChange={(e) => update(index, { packId: e.target.value })}
                            disabled={disabled}
                            required
                        >
                            <option value="">Choisir un pack…</option>
                            {packs.map((pack) => (
                                <option key={pack.id} value={pack.id}>
                                    {packOptionLabel(pack)}
                                </option>
                            ))}
                        </select>
                        <select
                            className={`${inputClass} w-32`}
                            aria-label="Période"
                            value={row.period}
                            onChange={(e) => update(index, { period: e.target.value as SubscriptionPeriod })}
                            disabled={disabled}
                        >
                            {PERIODS.map((period) => (
                                <option key={period} value={period}>
                                    {PERIOD_LABELS[period]}
                                </option>
                            ))}
                        </select>
                        <input
                            className={`${inputClass} w-24`}
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            aria-label="Taux (%)"
                            placeholder="%"
                            value={row.rate}
                            onChange={(e) => update(index, { rate: e.target.value })}
                            disabled={disabled}
                            required
                        />
                        {!disabled && (
                            <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-2 text-red-600 hover:text-red-800"
                                aria-label="Supprimer l'exception"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                    {isDuplicate(index) && <p className="text-xs text-red-600">Ce pack a déjà un taux pour cette période.</p>}
                </div>
            ))}
            {!disabled && (
                <button type="button" onClick={add} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
                    <Plus size={14} /> Ajouter une exception
                </button>
            )}
        </div>
    );
}
