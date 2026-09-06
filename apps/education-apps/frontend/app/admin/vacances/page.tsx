'use client';

import { useEffect, useState } from 'react';
import { CalendarOff, Trash2, Plus } from 'lucide-react';
import { holidaysService } from '@/lib/services/holidays';
import type { Holiday } from '@/types';

export default function VacancesPage() {
    const [items, setItems] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            setItems(await holidaysService.getAll());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !startDate || !endDate) return;
        setSaving(true);
        try {
            await holidaysService.create({ title: title.trim(), startDate, endDate });
            setTitle('');
            setStartDate('');
            setEndDate('');
            await fetchItems();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Supprimer cette période de congé ?')) return;
        setBusyId(id);
        try {
            await holidaysService.delete(id);
            await fetchItems();
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Vacances & congés</h1>
                    <p className="text-gray-600 mt-1">Périodes de fermeture affichées aux élèves</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-100">
                    <CalendarOff className="text-orange-600" size={24} />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <h2 className="font-bold text-gray-800 mb-4">Nouvelle période</h2>
                <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Titre</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ex: Vacances de printemps"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Début</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Fin</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="sm:col-span-4 flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
                    >
                        <Plus size={16} /> {saving ? 'Ajout…' : 'Ajouter'}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <h2 className="font-bold text-gray-800 mb-4">Périodes à venir</h2>
                {loading ? (
                    <p className="text-sm text-gray-400">Chargement…</p>
                ) : items.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune période enregistrée.</p>
                ) : (
                    <div className="space-y-3">
                        {items.map((h) => (
                            <div key={h.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="font-semibold text-gray-800">{h.title}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {new Date(h.startDate).toLocaleDateString('fr-FR')} – {new Date(h.endDate).toLocaleDateString('fr-FR')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleDelete(h.id)}
                                    disabled={busyId === h.id}
                                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 shrink-0"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
