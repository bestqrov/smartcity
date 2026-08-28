'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Users,
    User as UserIcon,
    Phone,
    Baby,
} from 'lucide-react';
import { getParents, createParent } from '@/lib/services/parents';
import type { Parent } from '@/types';

export default function ParentsPage() {
    const [parents, setParents] = useState<Parent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const initialFormData = {
        name: '',
        phone: '',
        whatsapp: '',
        email: '',
        cin: '',
        address: '',
    };
    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        fetchParents();
    }, []);

    const fetchParents = async () => {
        setIsLoading(true);
        try {
            const data = await getParents();
            setParents(data);
        } catch (error) {
            console.error('Failed to fetch parents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = () => {
        setFormData(initialFormData);
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await createParent({
                name: formData.name,
                phone: formData.phone,
                whatsapp: formData.whatsapp || undefined,
                email: formData.email || undefined,
                cin: formData.cin || undefined,
                address: formData.address || undefined,
            });
            await fetchParents();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to create parent:', error);
            alert('Erreur lors de la création du parent');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredParents = parents.filter((parent) => {
        const query = searchQuery.toLowerCase();
        return (
            parent.name?.toLowerCase().includes(query) ||
            parent.phone?.includes(searchQuery) ||
            parent.email?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Context Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Gestion des Parents
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gérez les parents et leurs accès QR
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleOpenModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 transition-colors font-medium"
                    >
                        <Plus size={18} />
                        Nouveau Parent
                    </button>
                </div>
            </div>

            {/* Statistics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total Parents</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{parents.length}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Baby size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500">Total Enfants</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                            {parents.reduce((sum, p) => sum + (p.students?.length || 0), 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Filters Bar */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Rechercher par nom, téléphone, email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <UserIcon size={14} /> Nom
                                    </div>
                                </th>
                                <th className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Phone size={14} /> Téléphone
                                    </div>
                                </th>
                                <th className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <Baby size={14} /> Enfants
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        <div className="flex justify-center items-center gap-3">
                                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            Chargement des données...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredParents.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                            <Search size={32} className="opacity-50" />
                                        </div>
                                        <p className="font-medium">Aucun parent trouvé</p>
                                        <p className="text-sm mt-1">Essayez de modifier votre recherche</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredParents.map((parent) => (
                                    <tr
                                        key={parent.id}
                                        className="hover:bg-blue-50/30 dark:hover:bg-slate-700/30 transition-all duration-200 group border-b border-slate-50 dark:border-slate-700/50"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
                                                    {parent.name?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                                                        {parent.name}
                                                    </div>
                                                    {parent.email && (
                                                        <div className="text-xs text-slate-500 mt-1">{parent.email}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                                                {parent.phone}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-900/40 text-slate-600 border border-slate-100 dark:border-slate-700/50">
                                                {parent.students?.length || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <a
                                                href={`/admin/parents/${parent.id}`}
                                                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                            >
                                                Voir
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                        <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <UserIcon className="text-white/80" />
                                Nouveau Parent
                            </h2>
                            <p className="text-white/80 text-sm mt-1">Informations de contact du parent</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom Complet *</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ex: Fatima Alaoui"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
                                    <input
                                        required
                                        type="tel"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="06 12 34 56 78"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        value={formData.whatsapp}
                                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">CIN</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        value={formData.cin}
                                        onChange={(e) => setFormData({ ...formData, cin: e.target.value })}
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors disabled:opacity-50"
                                >
                                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
