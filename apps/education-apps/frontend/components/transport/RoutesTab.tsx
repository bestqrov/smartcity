'use client';

import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { transportService, transportErrorMessage } from '@/lib/services/transport';
import type { Driver, TransportRoute, Vehicle } from '@/types';
import { cardCls, errorCls, inputCls, labelCls, primaryBtnCls } from './styles';

const emptyStop = { name: '', order: '', morningTime: '', afternoonTime: '', monthlyPrice: '' };

export default function RoutesTab() {
    const [routes, setRoutes] = useState<TransportRoute[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [price, setPrice] = useState('');
    const [stopForms, setStopForms] = useState<Record<string, typeof emptyStop>>({});

    const load = async () => {
        try {
            const [r, v, d] = await Promise.all([
                transportService.routes.list(),
                transportService.vehicles.list(),
                transportService.drivers.list(),
            ]);
            setRoutes(r);
            setVehicles(v);
            setDrivers(d);
        } catch (e) {
            setError(transportErrorMessage(e));
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

    const stopForm = (routeId: string) => stopForms[routeId] ?? emptyStop;
    const setStopField = (routeId: string, field: keyof typeof emptyStop, value: string) =>
        setStopForms((prev) => ({ ...prev, [routeId]: { ...stopForm(routeId), [field]: value } }));

    return (
        <div className="space-y-6">
            {error && <p className={errorCls}>{error}</p>}

            <div className={cardCls}>
                <h2 className="font-bold text-gray-800 mb-4">Nouvelle ligne</h2>
                <form
                    className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
                    onSubmit={(e) => {
                        e.preventDefault();
                        run(async () => {
                            await transportService.routes.create({
                                name,
                                vehicleId,
                                driverId,
                                monthlyPrice: price === '' ? null : Number(price),
                            });
                            setName('');
                            setPrice('');
                        });
                    }}
                >
                    <div>
                        <label className={labelCls}>Nom</label>
                        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div>
                        <label className={labelCls}>Véhicule</label>
                        <select className={inputCls} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
                            <option value="">—</option>
                            {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.plate} ({v.capacity})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Chauffeur</label>
                        <select className={inputCls} value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
                            <option value="">—</option>
                            {drivers.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className={labelCls}>Prix mensuel (MAD)</label>
                        <input type="number" min="0" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                    <button type="submit" className={primaryBtnCls}>
                        <Plus size={16} /> Créer
                    </button>
                </form>
            </div>

            {routes.length === 0 && <p className="text-sm text-gray-400">Aucune ligne.</p>}

            {routes.map((route) => {
                const form = stopForm(route.id);
                return (
                    <div key={route.id} className={cardCls}>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h3 className="font-bold text-gray-800">{route.name}</h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    {route.vehicle?.plate} · {route.driver?.name} ({route.driver?.phone})
                                    {route.monthlyPrice != null && ` · ${route.monthlyPrice} MAD/mois`}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    if (window.confirm(`Supprimer la ligne « ${route.name} » ?`)) {
                                        run(() => transportService.routes.remove(route.id));
                                    }
                                }}
                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 shrink-0"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4">
                            {(route.stops ?? []).length === 0 && <p className="text-sm text-gray-400">Aucun arrêt.</p>}
                            {(route.stops ?? []).map((stop) => (
                                <div
                                    key={stop.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm"
                                >
                                    <span>
                                        <span className="font-semibold">
                                            {stop.order}. {stop.name}
                                        </span>{' '}
                                        <span className="text-gray-500">
                                            · matin {stop.morningTime} · soir {stop.afternoonTime}
                                            {stop.monthlyPrice != null && ` · ${stop.monthlyPrice} MAD`}
                                        </span>
                                    </span>
                                    <button
                                        onClick={() => run(() => transportService.routes.removeStop(route.id, stop.id))}
                                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <form
                            className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end"
                            onSubmit={(e) => {
                                e.preventDefault();
                                run(async () => {
                                    await transportService.routes.addStop(route.id, {
                                        name: form.name,
                                        order: Number(form.order),
                                        morningTime: form.morningTime,
                                        afternoonTime: form.afternoonTime,
                                        monthlyPrice: form.monthlyPrice === '' ? null : Number(form.monthlyPrice),
                                    });
                                    setStopForms((prev) => ({ ...prev, [route.id]: emptyStop }));
                                });
                            }}
                        >
                            <div className="col-span-2">
                                <label className={labelCls}>Arrêt</label>
                                <input className={inputCls} value={form.name} onChange={(e) => setStopField(route.id, 'name', e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelCls}>Ordre</label>
                                <input type="number" min="1" className={inputCls} value={form.order} onChange={(e) => setStopField(route.id, 'order', e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelCls}>Matin</label>
                                <input type="time" className={inputCls} value={form.morningTime} onChange={(e) => setStopField(route.id, 'morningTime', e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelCls}>Soir</label>
                                <input type="time" className={inputCls} value={form.afternoonTime} onChange={(e) => setStopField(route.id, 'afternoonTime', e.target.value)} required />
                            </div>
                            <div>
                                <label className={labelCls}>Prix (MAD)</label>
                                <input type="number" min="0" className={inputCls} value={form.monthlyPrice} onChange={(e) => setStopField(route.id, 'monthlyPrice', e.target.value)} />
                            </div>
                            <button type="submit" className={`${primaryBtnCls} col-span-2 sm:col-span-6`}>
                                <Plus size={16} /> Ajouter l&apos;arrêt
                            </button>
                        </form>
                    </div>
                );
            })}
        </div>
    );
}
