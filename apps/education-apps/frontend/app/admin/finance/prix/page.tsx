'use client';

import { useState, useEffect } from 'react';
import {
    DollarSign,
    BookOpen,
    GraduationCap,
    Plus,
    Trash2,
    Pencil,
    Check,
    X,
    Loader2
} from 'lucide-react';
import api from '@/lib/api';

interface PricingItem {
    id: string;
    category: string; // 'SOUTIEN' | 'FORMATION'
    level: string;
    subject: string;
    price: number;
}

// Must match the exact levels the Inscription form's dropdown expects
// (SoutienInscriptionForm.tsx maps these accented labels to PRIMAIRE/COLLEGE/LYCEE).
const SOUTIEN_LEVELS = ['Primaire', 'Collège', 'Lycée'];

export default function PrixPage() {
    const [pricing, setPricing] = useState<PricingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [newSoutien, setNewSoutien] = useState({ level: SOUTIEN_LEVELS[0], subject: '', price: '' });
    const [newFormation, setNewFormation] = useState({ subject: '', price: '' });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const fetchPricing = async () => {
        setLoading(true);
        try {
            const res = await api.get('/pricing');
            if (res.data.success) setPricing(res.data.data);
        } catch (e) {
            setError('Impossible de charger les prix');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPricing();
    }, []);

    const soutienItems = pricing.filter((p) => p.category === 'SOUTIEN');
    const formationItems = pricing.filter((p) => p.category === 'FORMATION');

    const groupedSoutien = soutienItems.reduce((acc, item) => {
        if (!acc[item.level]) acc[item.level] = [];
        acc[item.level].push(item);
        return acc;
    }, {} as Record<string, PricingItem[]>);

    const handleAddSoutien = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSoutien.subject.trim()) return;
        setError('');
        try {
            await api.post('/pricing', {
                category: 'SOUTIEN',
                level: newSoutien.level,
                subject: newSoutien.subject.trim(),
                price: Number(newSoutien.price) || 0,
            });
            setNewSoutien({ level: newSoutien.level, subject: '', price: '' });
            fetchPricing();
        } catch (e) {
            setError("Impossible d'ajouter la matière");
        }
    };

    const handleAddFormation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFormation.subject.trim()) return;
        setError('');
        try {
            await api.post('/pricing', {
                category: 'FORMATION',
                level: 'FORMATION',
                subject: newFormation.subject.trim(),
                price: Number(newFormation.price) || 0,
            });
            setNewFormation({ subject: '', price: '' });
            fetchPricing();
        } catch (e) {
            setError("Impossible d'ajouter la formation");
        }
    };

    const startEdit = (item: PricingItem) => {
        setEditingId(item.id);
        setEditPrice(String(item.price));
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditPrice('');
    };

    const saveEdit = async (id: string) => {
        setBusyId(id);
        try {
            await api.put(`/pricing/${id}`, { price: Number(editPrice) || 0 });
            setEditingId(null);
            fetchPricing();
        } catch (e) {
            setError('Impossible de mettre à jour le prix');
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Supprimer cette matière ?')) return;
        setBusyId(id);
        try {
            await api.delete(`/pricing/${id}`);
            fetchPricing();
        } catch (e) {
            setError('Impossible de supprimer');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Gestion des Prix</h1>
                    <p className="text-gray-600 mt-1">Configurez les tarifs pour les cours et formations</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                    <DollarSign className="text-green-600" size={32} />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 rounded-lg p-4 text-sm font-medium">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                    <Loader2 className="animate-spin" size={28} />
                </div>
            ) : (
                <>
                    {/* Soutien Scolaire */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-purple-100 p-2 rounded-lg">
                                <BookOpen className="text-purple-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Soutien Scolaire</h2>
                                <p className="text-sm text-gray-500">Prix par niveau et matière — utilisé par le formulaire d'inscription</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-purple-100 to-purple-50 border-b-2 border-purple-200">
                                        <th className="text-left py-3 px-4 font-bold text-gray-700 border border-gray-200">NIVEAU</th>
                                        <th className="text-left py-3 px-4 font-bold text-gray-700 border border-gray-200">MATIÈRE</th>
                                        <th className="text-right py-3 px-4 font-bold text-gray-700 border border-gray-200 w-40">PRIX (DH)</th>
                                        <th className="text-right py-3 px-4 font-bold text-gray-700 border border-gray-200 w-28">ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(groupedSoutien).length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-6 px-4 text-center text-gray-400 border border-gray-200">
                                                Aucune matière configurée pour l'instant.
                                            </td>
                                        </tr>
                                    )}
                                    {Object.entries(groupedSoutien).map(([niveau, items]) => (
                                        items.map((item, index) => (
                                            <tr key={item.id} className="hover:bg-purple-50 transition-colors border-b border-gray-100">
                                                {index === 0 && (
                                                    <td
                                                        rowSpan={items.length}
                                                        className="py-4 px-4 font-bold text-purple-700 bg-purple-50 border border-gray-200 align-top"
                                                    >
                                                        {niveau}
                                                    </td>
                                                )}
                                                <td className="py-4 px-4 font-medium text-gray-800 border border-gray-200">{item.subject}</td>
                                                <td className="py-4 px-4 text-right border border-gray-200">
                                                    {editingId === item.id ? (
                                                        <input
                                                            type="number"
                                                            value={editPrice}
                                                            onChange={(e) => setEditPrice(e.target.value)}
                                                            className="w-24 px-2 py-1 border-2 border-purple-300 rounded-lg text-right focus:border-purple-500 focus:outline-none"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="font-semibold">{item.price} DH</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4 text-right border border-gray-200">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {editingId === item.id ? (
                                                            <>
                                                                <button
                                                                    onClick={() => saveEdit(item.id)}
                                                                    disabled={busyId === item.id}
                                                                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={cancelEdit}
                                                                    className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => startEdit(item)}
                                                                    className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(item.id)}
                                                                    disabled={busyId === item.id}
                                                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <form onSubmit={handleAddSoutien} className="mt-6 flex flex-wrap items-end gap-3 pt-6 border-t border-gray-100">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Niveau</label>
                                <select
                                    value={newSoutien.level}
                                    onChange={(e) => setNewSoutien((prev) => ({ ...prev, level: e.target.value }))}
                                    className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                                >
                                    {SOUTIEN_LEVELS.map((lvl) => (
                                        <option key={lvl} value={lvl}>{lvl}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Matière</label>
                                <input
                                    type="text"
                                    value={newSoutien.subject}
                                    onChange={(e) => setNewSoutien((prev) => ({ ...prev, subject: e.target.value }))}
                                    placeholder="ex: Maths"
                                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Prix (DH)</label>
                                <input
                                    type="number"
                                    value={newSoutien.price}
                                    onChange={(e) => setNewSoutien((prev) => ({ ...prev, price: e.target.value }))}
                                    placeholder="0"
                                    className="w-28 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                                />
                            </div>
                            <button
                                type="submit"
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                            >
                                <Plus size={16} /> Ajouter
                            </button>
                        </form>
                    </div>

                    {/* Formations Professionnelles */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-orange-100 p-2 rounded-lg">
                                <GraduationCap className="text-orange-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800">Formations Professionnelles</h2>
                                <p className="text-sm text-gray-500">Prix par formation (complète)</p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-orange-100 to-orange-50 border-b-2 border-orange-200">
                                        <th className="text-left py-3 px-4 font-bold text-gray-700 border border-gray-200">FORMATION</th>
                                        <th className="text-right py-3 px-4 font-bold text-gray-700 border border-gray-200 w-40">PRIX (DH)</th>
                                        <th className="text-right py-3 px-4 font-bold text-gray-700 border border-gray-200 w-28">ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formationItems.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="py-6 px-4 text-center text-gray-400 border border-gray-200">
                                                Aucune formation configurée pour l'instant.
                                            </td>
                                        </tr>
                                    )}
                                    {formationItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-orange-50 transition-colors border-b border-gray-100">
                                            <td className="py-4 px-4 font-medium text-gray-800 border border-gray-200">{item.subject}</td>
                                            <td className="py-4 px-4 text-right border border-gray-200">
                                                {editingId === item.id ? (
                                                    <input
                                                        type="number"
                                                        value={editPrice}
                                                        onChange={(e) => setEditPrice(e.target.value)}
                                                        className="w-24 px-2 py-1 border-2 border-orange-300 rounded-lg text-right focus:border-orange-500 focus:outline-none"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className="font-semibold">{item.price} DH</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-right border border-gray-200">
                                                <div className="flex items-center justify-end gap-2">
                                                    {editingId === item.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => saveEdit(item.id)}
                                                                disabled={busyId === item.id}
                                                                className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => startEdit(item)}
                                                                className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(item.id)}
                                                                disabled={busyId === item.id}
                                                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <form onSubmit={handleAddFormation} className="mt-6 flex flex-wrap items-end gap-3 pt-6 border-t border-gray-100">
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-bold text-gray-500 mb-1">Formation</label>
                                <input
                                    type="text"
                                    value={newFormation.subject}
                                    onChange={(e) => setNewFormation((prev) => ({ ...prev, subject: e.target.value }))}
                                    placeholder="ex: Coiffure"
                                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Prix (DH)</label>
                                <input
                                    type="number"
                                    value={newFormation.price}
                                    onChange={(e) => setNewFormation((prev) => ({ ...prev, price: e.target.value }))}
                                    placeholder="0"
                                    className="w-28 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                                />
                            </div>
                            <button
                                type="submit"
                                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                            >
                                <Plus size={16} /> Ajouter
                            </button>
                        </form>
                    </div>
                </>
            )}
        </div>
    );
}
