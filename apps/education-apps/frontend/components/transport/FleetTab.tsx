'use client';

import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { Driver, Vehicle } from '@/types';
import { cardCls, errorCls, inputCls, labelCls, primaryBtnCls } from './styles';

import { useI18n } from '@/lib/i18n/I18nProvider';
export default function FleetTab() {
    const { tr } = useI18n();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [plate, setPlate] = useState('');
    const [capacity, setCapacity] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setError('');
        setLoading(true);
        try {
            const [v, d] = await Promise.all([transportService.vehicles.list(), transportService.drivers.list()]);
            setVehicles(v);
            setDrivers(d);
        } catch (e) {
            setError(transportErrorMessage(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const run = async (action: () => Promise<unknown>) => {
        setError('');
        try {
            await action();
            await load();
        } catch (e) {
            setError(transportErrorMessage(e));
        }
    };

    return (
        <div className="space-y-6">
            {error && <p className={errorCls}>{tr(error)}</p>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cardCls}>
                    <h2 className="font-bold text-gray-800 mb-4">{tr("Véhicules")}</h2>
                    <form
                        className="grid grid-cols-3 gap-2 items-end mb-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                                await transportService.vehicles.create({ plate, capacity: Number(capacity) });
                                setPlate('');
                                setCapacity('');
                            });
                        }}
                    >
                        <div className="col-span-2">
                            <label className={labelCls}>{tr("Immatriculation")}</label>
                            <input className={inputCls} value={plate} onChange={(e) => setPlate(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>{tr("Places")}</label>
                            <input
                                type="number"
                                min="1"
                                className={inputCls}
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className={`${primaryBtnCls} col-span-3`}>
                            <Plus size={16} />{tr("Ajouter un véhicule")}</button>
                    </form>
                    <div className="space-y-2">
                        {loading && <p className="text-sm text-gray-400">{tr("Chargement…")}</p>}
                        {!loading && vehicles.length === 0 && <p className="text-sm text-gray-400">{tr("Aucun véhicule.")}</p>}
                        {vehicles.map((v) => (
                            <div key={v.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="font-semibold text-gray-800">{v.plate}</p>
                                    <p className="text-xs text-gray-500">{v.capacity} places</p>
                                </div>
                                <button
                                    onClick={() => run(() => transportService.vehicles.remove(v.id))}
                                    aria-label={tr("Supprimer le véhicule")}
                                    className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={cardCls}>
                    <h2 className="font-bold text-gray-800 mb-4">{tr("Chauffeurs")}</h2>
                    <form
                        className="grid grid-cols-2 gap-2 items-end mb-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            run(async () => {
                                await transportService.drivers.create({ name: driverName, phone: driverPhone });
                                setDriverName('');
                                setDriverPhone('');
                            });
                        }}
                    >
                        <div>
                            <label className={labelCls}>{tr("Nom")}</label>
                            <input className={inputCls} value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
                        </div>
                        <div>
                            <label className={labelCls}>{tr("Téléphone")}</label>
                            <input className={inputCls} value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} required />
                        </div>
                        <button type="submit" className={`${primaryBtnCls} col-span-2`}>
                            <Plus size={16} />{tr("Ajouter un chauffeur")}</button>
                    </form>
                    <div className="space-y-2">
                        {loading && <p className="text-sm text-gray-400">{tr("Chargement…")}</p>}
                        {!loading && drivers.length === 0 && <p className="text-sm text-gray-400">{tr("Aucun chauffeur.")}</p>}
                        {drivers.map((d) => (
                            <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="font-semibold text-gray-800">{d.name}</p>
                                    <p className="text-xs text-gray-500">{d.phone}</p>
                                </div>
                                <button
                                    onClick={() => run(() => transportService.drivers.remove(d.id))}
                                    aria-label={tr("Supprimer le chauffeur")}
                                    className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
