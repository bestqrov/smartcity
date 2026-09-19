'use client';

import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '@/lib/services/settings';
import { transportErrorMessage } from '@/lib/services/transport';
import type { TransportPricingMode } from '@/types';
import { cardCls, errorCls, inputCls, labelCls, primaryBtnCls } from './styles';

const MODES: { value: TransportPricingMode; label: string; hint: string }[] = [
    { value: 'ROUTE', label: 'Prix par ligne', hint: 'Chaque ligne a son tarif mensuel.' },
    { value: 'STOP', label: 'Prix par arrêt', hint: 'Chaque arrêt a son tarif (selon la distance).' },
    { value: 'UNIFORM', label: 'Prix unique', hint: 'Un seul tarif pour tous les élèves.' },
];

export default function PricingModePanel() {
    const [mode, setMode] = useState<TransportPricingMode>('ROUTE');
    const [uniformPrice, setUniformPrice] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        getSettings()
            .then((settings) => {
                setMode(settings.transportPricingMode ?? 'ROUTE');
                setUniformPrice(settings.transportUniformPrice != null ? String(settings.transportUniformPrice) : '');
            })
            .catch((e) => setError(transportErrorMessage(e)));
    }, []);

    const save = async () => {
        setSaving(true);
        setSaved(false);
        setError('');
        try {
            await updateSettings({
                transportPricingMode: mode,
                transportUniformPrice: uniformPrice === '' ? null : Number(uniformPrice),
            } as any);
            setSaved(true);
        } catch (e) {
            setError(transportErrorMessage(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={cardCls}>
            <h2 className="font-bold text-gray-800 mb-1">Tarification du transport</h2>
            <p className="text-xs text-gray-500 mb-4">
                Le tarif est figé à l&apos;inscription de l&apos;élève : modifier le mode n&apos;affecte pas les abonnements existants.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {MODES.map((m) => (
                    <label
                        key={m.value}
                        className={`cursor-pointer rounded-xl border p-3 text-sm ${
                            mode === m.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                    >
                        <input
                            type="radio"
                            name="transportPricingMode"
                            className="mr-2"
                            checked={mode === m.value}
                            onChange={() => setMode(m.value)}
                        />
                        <span className="font-semibold">{m.label}</span>
                        <span className="block text-xs text-gray-500 mt-1">{m.hint}</span>
                    </label>
                ))}
            </div>
            {mode === 'UNIFORM' && (
                <div className="max-w-xs mb-4">
                    <label className={labelCls}>Prix mensuel unique (MAD)</label>
                    <input
                        type="number"
                        min="0"
                        className={inputCls}
                        value={uniformPrice}
                        onChange={(e) => setUniformPrice(e.target.value)}
                    />
                </div>
            )}
            {error && <p className={`${errorCls} mb-3`}>{error}</p>}
            <button onClick={save} disabled={saving} className={primaryBtnCls}>
                {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
            </button>
        </div>
    );
}
