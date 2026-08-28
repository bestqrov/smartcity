'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/Button';
import {
    PlusCircle,
    Edit,
    Trash2,
    Users,
    BookCopy,
    Search,
    MessageSquare,
    User as UserIcon,
    Link as LinkIcon,
    GraduationCap,
    Briefcase,
    Building,
    TrendingUp
} from 'lucide-react';
import { groupsService } from '@/lib/services/groups';
import { teachersService } from '@/lib/services/teachers';
import { formationsService } from '@/lib/services/formations';

// Types
interface Group {
    id: string;
    name: string;
    type: 'SOUTIEN' | 'FORMATION';
    subject?: string;
    level?: string; // used for SOUTIEN
    formation?: { id: string; name: string };
    teacher?: { id: string; name: string };
    whatsappUrl?: string;
    room?: string;
    students: any[];
}

interface Teacher {
    id: string;
    name: string;
}

interface Formation {
    id: string;
    name: string;
}

const NIVEAUX_SCOLAIRE = [
    { key: 'primaire', nameKey: 'Primaire' },
    { key: 'college', nameKey: 'Collège' },
    { key: 'lycee', nameKey: 'Lycée' },
];

const SUBJECTS = [
    'Mathématiques', 'Physique', 'Chimie', 'SVT',
    'Français', 'Anglais', 'Arabe', 'Histoire-Géo',
    'Philosophie', 'Informatique'
];

const GroupsContent = () => {
    const searchParams = useSearchParams();
    // Deterministic type from URL or null (view all/soutien default?)
    // If type=FORMATION, we lock the UI to Formation mode
    const contextType = searchParams.get('type') as 'FORMATION' | 'SOUTIEN' | null;

    const [groups, setGroups] = useState<Group[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [formations, setFormations] = useState<Formation[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedRooms = localStorage.getItem('rooms');
        if (storedRooms) {
            try {
                setRooms(JSON.parse(storedRooms));
            } catch (e) {
                console.error("Failed to parse rooms", e);
            }
        }
    }, []);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const initialFormData = {
        name: '',
        type: contextType || 'SOUTIEN',
        subject: '',
        level: '',
        formationId: '',
        teacherId: '',
        whatsappUrl: '',
        room: '',
    };
    const [formData, setFormData] = useState(initialFormData);

    // Initial Load
    useEffect(() => {
        fetchData();
    }, [contextType]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [groupsData, teachersData, formationsData] = await Promise.all([
                groupsService.getAll(contextType || undefined), // If contextType is null, maybe fetch all or default? 
                teachersService.getAll(),
                formationsService.getAll(),
            ]);
            setGroups(groupsData || []);
            setTeachers(teachersData || []);

            // Handle both array and wrapped response formats
            const formationsList = Array.isArray(formationsData)
                ? formationsData
                : (formationsData as any)?.data || [];

            setFormations(formationsList);
        } catch (error) {
            console.error('Error fetching data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (group: Group | null) => {
        setEditingGroup(group);
        if (group) {
            setFormData({
                name: group.name,
                type: group.type,
                subject: group.subject || '',
                level: group.level || '',
                formationId: group.formation?.id || '',
                teacherId: group.teacher?.id || '',
                whatsappUrl: group.whatsappUrl || '',
                room: group.room || '',
            });
        } else {
            setFormData({ ...initialFormData, type: contextType || 'SOUTIEN' });
        }
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingGroup) {
                await groupsService.update(editingGroup.id, formData);
            } else {
                await groupsService.create(formData);
            }
            fetchData();
            setIsModalOpen(false);
            setEditingGroup(null);
        } catch (error) {
            alert('Erreur lors de l\'enregistrement');
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Supprimer ce groupe ?')) {
            try {
                await groupsService.delete(id);
                fetchData();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const filteredGroups = useMemo(() => {
        return groups.filter(g =>
            g.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [groups, searchTerm]);

    // Theme Config based on Context
    const isFormationMode = contextType === 'FORMATION';
    const themeColor = isFormationMode ? 'purple' : 'blue';
    const ThemeIcon = isFormationMode ? Briefcase : GraduationCap;

    // Gradient definitions
    const headerGradient = isFormationMode
        ? 'from-purple-600 to-pink-600'
        : 'from-blue-600 to-indigo-600';

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isFormationMode ? 'Gestion des Groupes (Formation Pro)' : 'Gestion des Groupes'}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {isFormationMode
                            ? 'Gérez vos cohortes de formation professionnelle'
                            : 'Organisez vos étudiants en groupes par matière et niveau'}
                    </p>
                </div>
                <Button
                    onClick={() => handleOpenModal(null)}
                    className={`bg-gradient-to-r ${headerGradient} text-white shadow-lg`}
                >
                    <PlusCircle size={18} className="mr-2" /> Nouveau Groupe
                </Button>
            </div>

            {/* Groups Grid */}
            {!isModalOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredGroups.map(group => (
                        <div key={group.id} className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className={`font-bold text-lg text-gray-900 group-hover:text-${themeColor}-600 transition-colors`}>
                                            {group.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {group.type === 'FORMATION' ? group.formation?.name : group.subject}
                                        </p>
                                    </div>
                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full bg-${themeColor}-50 text-${themeColor}-700`}>
                                        {group.type === 'FORMATION' ? 'Formation' : group.level}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm text-gray-600 mt-4">
                                    {group.teacher && (
                                        <div className="flex items-center gap-2">
                                            <UserIcon size={14} className="text-gray-400" />
                                            <span>Prof: <span className="font-medium">{group.teacher.name}</span></span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Users size={14} className="text-gray-400" />
                                        <span>{group.students?.length || 0} Étudiants</span>
                                    </div>
                                    {group.room && (
                                        <div className="flex items-center gap-2">
                                            <Briefcase size={14} className="text-gray-400" />
                                            <span>Salle: {group.room}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-2">
                                {group.whatsappUrl && (
                                    <a href={group.whatsappUrl} target="_blank" className="p-2 text-green-600 hover:bg-green-100 rounded-lg">
                                        <MessageSquare size={18} />
                                    </a>
                                )}
                                <button onClick={() => handleOpenModal(group)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">
                                    <Edit size={18} />
                                </button>
                                <button onClick={() => handleDelete(group.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form View (Replaces Grid) */}
            {isModalOpen && (
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className={`relative overflow-hidden bg-gradient-to-br ${headerGradient} p-8 text-white`}>
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/10 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                                    <ThemeIcon size={24} className="text-white" />
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight">
                                    {editingGroup ? 'Modifier le Groupe' : 'Créer un Nouveau Groupe'}
                                </h2>
                            </div>
                            <p className="text-white/90 font-medium ml-1 text-lg">
                                {isFormationMode
                                    ? 'Configurez une nouvelle cohorte de formation professionnelle'
                                    : 'Organisez une nouvelle classe de soutien scolaire'}
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleFormSubmit} className="p-8 space-y-8 bg-gray-50/50">
                        {/* Section 1: Informations Générales */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                            <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${headerGradient}`}></div>
                            <div className="flex items-center gap-2 mb-6 text-gray-800">
                                <BookCopy size={20} className={`text-${themeColor}-600`} />
                                <h3 className="font-bold text-lg">Informations Principales</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Nom du Groupe <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            required
                                            type="text"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all font-medium"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Ex : Groupe Excellence 2024"
                                        />
                                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 ml-1">Le nom qui apparaîtra sur les emplois du temps et les listes.</p>
                                </div>

                                {isFormationMode && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Formation Associée <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <select
                                                required
                                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all appearance-none bg-white font-medium"
                                                value={formData.formationId}
                                                onChange={e => setFormData({ ...formData, formationId: e.target.value })}
                                            >
                                                <option value="">Sélectionner la formation...</option>
                                                {formations.map(f => (
                                                    <option key={f.id} value={f.id}>{f.name}</option>
                                                ))}
                                            </select>
                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 2: Détails Académiques (Only for Soutien) */}
                        {!isFormationMode && (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
                                <div className="flex items-center gap-2 mb-6 text-gray-800">
                                    <GraduationCap size={20} className="text-blue-600" />
                                    <h3 className="font-bold text-lg">Détails Académiques</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Niveau Scolaire</label>
                                        <div className="relative">
                                            <select
                                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none bg-white font-medium"
                                                value={formData.level}
                                                onChange={e => setFormData({ ...formData, level: e.target.value })}
                                            >
                                                <option value="">Choisir le niveau...</option>
                                                {NIVEAUX_SCOLAIRE.map(n => <option key={n.key} value={n.key}>{n.nameKey}</option>)}
                                            </select>
                                            <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Matière Enseignée</label>
                                        <div className="relative">
                                            <select
                                                className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none bg-white font-medium"
                                                value={formData.subject}
                                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                            >
                                                <option value="">Choisir la matière...</option>
                                                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                            <BookCopy className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section 3: Logistique & Contact */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500 to-teal-500"></div>
                            <div className="flex items-center gap-2 mb-6 text-gray-800">
                                <Users size={20} className="text-emerald-600" />
                                <h3 className="font-bold text-lg">Logistique & Contact</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Professeur Attitré</label>
                                    <div className="relative">
                                        <select
                                            className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none bg-white font-medium"
                                            value={formData.teacherId}
                                            onChange={e => setFormData({ ...formData, teacherId: e.target.value })}
                                        >
                                            <option value="">Sans professeur...</option>
                                            {teachers.map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Salle de Cours</label>
                                    <div className="relative">
                                        <select
                                            className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none bg-white font-medium"
                                            value={formData.room}
                                            onChange={e => setFormData({ ...formData, room: e.target.value })}
                                        >
                                            <option value="">Sélectionner une salle...</option>
                                            {rooms.map(r => (
                                                <option key={r.id} value={r.name}>{r.name} ({r.capacity || '?'} places) {r.type ? `- ${r.type}` : ''}</option>
                                            ))}
                                        </select>
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Lien WhatsApp du Groupe</label>
                                    <div className="relative">
                                        <input
                                            type="url"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all font-medium"
                                            value={formData.whatsappUrl}
                                            onChange={e => setFormData({ ...formData, whatsappUrl: e.target.value })}
                                            placeholder="https://chat.whatsapp.com/..."
                                        />
                                        <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2 ml-1">Ce lien sera accessible directement depuis la liste des groupes.</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex justify-end gap-4 pt-6">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg bg-gradient-to-r ${headerGradient} transform hover:-translate-y-1 transition-all duration-200`}
                            >
                                {editingGroup ? 'Enregistrer les Modifications' : 'Créer le Groupe'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <style jsx>{`
                .label { @apply block text-sm font-medium text-gray-700 mb-1.5; }
                .input-field { @apply w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-${themeColor}-500/20 focus:border-${themeColor}-500 outline-none transition-all; }
            `}</style>
        </div>
    );
};

export default function GroupsPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <GroupsContent />
        </Suspense>
    );
}
