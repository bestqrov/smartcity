'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Trash2, Plus } from 'lucide-react';
import { announcementsService } from '@/lib/services/announcements';
import type { Announcement } from '@/types';

export default function AnnoncesPage() {
    const [items, setItems] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const fetchItems = async () => {
        setLoading(true);
        try {
            setItems(await announcementsService.getAll());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchItems(); }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !body.trim()) return;
        setSaving(true);
        try {
            await announcementsService.create({ title: title.trim(), body: body.trim() });
            setTitle('');
            setBody('');
            await fetchItems();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Supprimer cette annonce ?')) return;
        setBusyId(id);
        try {
            await announcementsService.delete(id);
            await fetchItems();
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="p-6 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Annonces</h1>
                    <p className="text-gray-600 mt-1">Informations diffusées aux élèves sur leur espace personnel</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-100">
                    <Megaphone className="text-amber-600" size={24} />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <h2 className="font-bold text-gray-800 mb-4">Nouvelle annonce</h2>
                <form onSubmit={handleCreate} className="space-y-3">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Titre"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                        required
                    />
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Contenu de l'annonce"
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400"
                        required
                    />
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold"
                    >
                        <Plus size={16} /> {saving ? 'Ajout…' : 'Publier'}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                <h2 className="font-bold text-gray-800 mb-4">Annonces publiées</h2>
                {loading ? (
                    <p className="text-sm text-gray-400">Chargement…</p>
                ) : items.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune annonce pour l'instant.</p>
                ) : (
                    <div className="space-y-3">
                        {items.map((a) => (
                            <div key={a.id} className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div>
                                    <p className="font-semibold text-gray-800">{a.title}</p>
                                    <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{a.body}</p>
                                    <p className="text-xs text-gray-400 mt-2">{new Date(a.createdAt).toLocaleDateString('fr-FR')}</p>
                                </div>
                                <button
                                    onClick={() => handleDelete(a.id)}
                                    disabled={busyId === a.id}
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
