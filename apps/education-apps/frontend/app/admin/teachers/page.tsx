'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/Button';
import {
    PlusCircle,
    Edit,
    Trash2,
    Search,
    User,
    Mail,
    Phone,
    BookOpen,
    GraduationCap,
    Clock,
    Palette,
    Scissors,
    Monitor,
    Calculator,
    Briefcase,
    DollarSign,
    Percent
} from 'lucide-react';
import { teachersService } from '@/lib/services/teachers';
import { formationsService } from '@/lib/services/formations';
import { Teacher } from '@/types';

// Use global Teacher interface from @/types


const NIVEAUX_SCOLAIRE = [
    { key: 'primaire', nameKey: 'Primaire' },
    { key: 'college', nameKey: 'Collège' },
    { key: 'lycee', nameKey: 'Lycée' },
    { key: 'formation', nameKey: 'Formation Pro' }
];

const GENERAL_SUBJECTS = [
    'Mathématiques', 'Physique', 'Chimie', 'SVT',
    'Français', 'Anglais', 'Arabe', 'Histoire-Géo',
    'Philosophie', 'Informatique'
];

const PAYMENT_TYPES = [
    { key: 'HOURLY', label: 'Par Heure' },
    { key: 'FIXED', label: 'Salaire Fixe (Global)' },
    { key: 'PERCENTAGE', label: '% par Inscription' }
];

const TeachersContent = () => {
    const searchParams = useSearchParams();
    const type = searchParams.get('type') as 'FORMATION' | 'SOUTIEN' | null;
    const isFormationMode = type === 'FORMATION';

    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [formations, setFormations] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const initialFormData = {
        name: '',
        email: '',
        phone: '',
        cin: '',
        gender: 'Male',
        status: 'Active' as 'Active' | 'Inactive',
        socialMedia: {
            linkedin: '',
            twitter: '',
            facebook: '',
            whatsapp: ''
        },
        hourlyRate: 0,
        paymentType: 'HOURLY' as 'HOURLY' | 'FIXED' | 'PERCENTAGE',
        commission: 0,
        specialties: [] as string[],
        levels: [] as string[]
    };
    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        fetchTeachers();
        if (isFormationMode) {
            fetchFormations();
        }
    }, [isFormationMode]);

    const fetchTeachers = async () => {
        try {
            setLoading(true);
            const data = await teachersService.getAll();
            setTeachers(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFormations = async () => {
        try {
            const data = await formationsService.getAll();
            // Assuming data is array or wrapped object as handled before
            const list = Array.isArray(data) ? data : (data as any).data || [];
            // Extract unique formation names for specialties list
            setFormations(list.map((f: any) => f.name));
        } catch (error) {
            console.error('Failed to load formations', error);
        }
    };

    const handleOpenModal = (teacher: Teacher | null) => {
        setEditingTeacher(teacher);
        if (teacher) {
            setFormData({
                name: teacher.name,
                email: teacher.email || '',
                phone: teacher.phone || '',
                cin: teacher.cin || '',
                gender: teacher.gender || 'Male',
                status: teacher.status || 'Active',
                socialMedia: {
                    linkedin: teacher.socialMedia?.linkedin || '',
                    twitter: teacher.socialMedia?.twitter || '',
                    facebook: teacher.socialMedia?.facebook || '',
                    whatsapp: teacher.socialMedia?.whatsapp || ''
                },
                hourlyRate: teacher.hourlyRate || 0,
                paymentType: (teacher.paymentType as any) || 'HOURLY',
                commission: teacher.commission || 0,
                specialties: teacher.specialties || [],
                levels: teacher.levels || []
            });
        } else {
            setFormData(initialFormData);
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingTeacher) {
                await teachersService.update(editingTeacher.id, formData);
            } else {
                await teachersService.create(formData);
            }
            fetchTeachers();
            setIsModalOpen(false);
        } catch (error) {
            alert('Erreur lors de l\'enregistrement');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Supprimer ce professeur ?')) {
            try {
                await teachersService.delete(id);
                fetchTeachers();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const toggleSelection = (field: 'specialties' | 'levels', value: string) => {
        setFormData(prev => {
            const current = prev[field];
            const updated = current.includes(value)
                ? current.filter(item => item !== value)
                : [...current, value];
            return { ...prev, [field]: updated };
        });
    };

    const filteredTeachers = teachers.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Dynamic Design Config
    const headerGradient = isFormationMode
        ? 'from-blue-600 via-indigo-600 to-purple-600'
        : 'from-amber-500 to-orange-500';

    const buttonClass = isFormationMode
        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-purple-500/20'
        : 'bg-amber-600 text-white shadow-lg shadow-amber-600/20';

    const subjectsList = isFormationMode ? formations : GENERAL_SUBJECTS;

    const getSubjectIcon = (subject: string) => {
        if (subject.toLowerCase().includes('coiffure')) return <Scissors size={14} />;
        if (subject.toLowerCase().includes('infographie')) return <Palette size={14} />;
        if (subject.toLowerCase().includes('bureautique')) return <Monitor size={14} />;
        if (subject.toLowerCase().includes('compta')) return <Calculator size={14} />;
        return <BookOpen size={14} />;
    };

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isFormationMode ? 'Formateurs & Instructeurs' : 'Gestion des Professeurs'}
                    </h1>
                    <p className="text-gray-500 mt-1">
                        {isFormationMode ? 'Gérez les experts de vos formations professionnelles' : 'Gérez votre équipe pédagogique'}
                    </p>
                </div>
                <Button
                    onClick={() => handleOpenModal(null)}
                    className={`${buttonClass} hover:opacity-90 transition-opacity`}
                >
                    <PlusCircle size={18} className="mr-2" />
                    {isFormationMode ? 'Nouveau Formateur' : 'Nouveau Professeur'}
                </Button>
            </div>

            {/* Search */}
            <div className={`p-1 rounded-xl bg-gradient-to-r ${headerGradient} shadow-sm`}>
                <div className="bg-white rounded-lg p-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder={isFormationMode ? "Rechercher un instructeur..." : "Rechercher par nom ou matière..."}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border-none rounded-lg focus:ring-0 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredTeachers.map(teacher => (
                    <div key={teacher.id} className="group bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20 bg-gradient-to-br ${['from-pink-500 to-rose-500', 'from-purple-500 to-indigo-500', 'from-cyan-500 to-blue-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500'][teacher.name.length % 5]
                                    }`}>
                                    {teacher.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">{teacher.name}</h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                        <Mail size={12} className="text-orange-400" />
                                        {teacher.email}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(teacher)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={16} /></button>
                                <button onClick={() => handleDelete(teacher.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        <div className="space-y-3 mb-4">
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <Phone size={14} className="text-green-500" />
                                <span>{teacher.phone || 'Non renseigné'}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {teacher.specialties.map((s, idx) => (
                                    <span key={s} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${['bg-blue-50 text-blue-700 border-blue-100', 'bg-purple-50 text-purple-700 border-purple-100', 'bg-rose-50 text-rose-700 border-rose-100', 'bg-amber-50 text-amber-700 border-amber-100'][idx % 4]
                                        }`}>
                                        {isFormationMode && getSubjectIcon(s)}
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                            <span className="flex items-center gap-1 text-gray-500">
                                <User size={14} className="text-indigo-400" />
                                {teacher._count?.groups || 0} Groupes
                            </span>
                            <div className="text-right">
                                <p className={`font-bold ${isFormationMode ? 'text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600' : 'text-gray-900'}`}>
                                    {teacher.paymentType === 'PERCENTAGE'
                                        ? `${teacher.commission}% / Ins.`
                                        : `${teacher.hourlyRate} MAD${teacher.paymentType === 'HOURLY' ? '/h' : ''}`}
                                </p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{teacher.paymentType}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className={`px-6 py-5 bg-gradient-to-r ${headerGradient}`}>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {isFormationMode ? <Briefcase className="text-white/80" /> : <User className="text-white/80" />}
                                {editingTeacher ? 'Modifier le Formateur' : 'Nouveau Formateur'}
                            </h2>
                            <p className="text-white/80 text-sm mt-1">
                                {isFormationMode ? 'Information professionnelle et spécialités' : 'Détails du professeur'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="label font-bold text-blue-700 dark:text-yellow-400">Nom Complet *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            required
                                            type="text"
                                            className="input pl-10"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Ex: Ahmed Bennani"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1 ml-1">Nom complet tel qu'il apparaîtra sur les contrats</p>
                                </div>

                                <div>
                                    <label className="label font-bold text-blue-700 dark:text-yellow-400">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="email" className="input pl-10" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="label font-bold text-blue-700 dark:text-yellow-400">Téléphone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input type="tel" className="input pl-10" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                </div>

                                <div>
                                    <label className="label font-bold text-blue-700 dark:text-yellow-400">CIN</label>
                                    <input type="text" className="input" value={formData.cin} onChange={e => setFormData({ ...formData, cin: e.target.value })} placeholder="Numéro CIN" />
                                </div>

                                <div>
                                    <label className="label font-bold text-blue-700 dark:text-yellow-400">Genre</label>
                                    <select className="input" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                        <option value="Male">Homme</option>
                                        <option value="Female">Femme</option>
                                    </select>
                                </div>

                                <div className="col-span-2 bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200">
                                    <h3 className="text-sm font-bold text-blue-700 dark:text-yellow-400 mb-4 flex items-center gap-2">
                                        🌐 Réseaux Sociaux & Contact
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">WhatsApp</label>
                                            <input type="text" className="input py-1.5" value={formData.socialMedia.whatsapp} onChange={e => setFormData({ ...formData, socialMedia: { ...formData.socialMedia, whatsapp: e.target.value } })} placeholder="Numéro" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Facebook</label>
                                            <input type="text" className="input py-1.5" value={formData.socialMedia.facebook} onChange={e => setFormData({ ...formData, socialMedia: { ...formData.socialMedia, facebook: e.target.value } })} placeholder="Pseudo/Lien" />
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h3 className="text-sm font-bold text-blue-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
                                        <DollarSign size={16} /> Information Financière
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="label text-xs uppercase tracking-wide text-gray-500">Type de Paiement</label>
                                            <select
                                                className="input"
                                                value={formData.paymentType}
                                                onChange={e => setFormData({ ...formData, paymentType: e.target.value as any })}
                                            >
                                                {PAYMENT_TYPES.map(t => (
                                                    <option key={t.key} value={t.key}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {formData.paymentType === 'PERCENTAGE' ? (
                                            <div>
                                                <label className="label text-xs uppercase tracking-wide text-gray-500">Commission (%)</label>
                                                <div className="relative">
                                                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input
                                                        type="number"
                                                        className="input pl-10"
                                                        value={formData.commission}
                                                        onChange={e => setFormData({ ...formData, commission: parseFloat(e.target.value) })}
                                                        placeholder="Ex: 30"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">Pourcentage par inscription</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="label text-xs uppercase tracking-wide text-gray-500">
                                                    {formData.paymentType === 'HOURLY' ? 'Taux Horaire (MAD/h)' : 'Salaire Fixe (MAD)'}
                                                </label>
                                                <div className="relative">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input
                                                        type="number"
                                                        className="input pl-10"
                                                        value={formData.hourlyRate}
                                                        onChange={e => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <label className="label font-bold text-blue-700 dark:text-yellow-400 mb-3 block flex items-center gap-2">
                                        <BookOpen size={16} className={isFormationMode ? "text-indigo-500" : "text-amber-500"} />
                                        {isFormationMode ? 'Compétences (Formations)' : 'Matières enseignées'}
                                    </label>

                                    {isFormationMode && subjectsList.length === 0 ? (
                                        <div className="p-4 bg-orange-50 text-orange-600 rounded-lg text-sm mb-2">
                                            Aucune formation trouvée. Veuillez d'abord créer des formations.
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100 max-h-40 overflow-y-auto">
                                            {subjectsList.map(s => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    onClick={() => toggleSelection('specialties', s)}
                                                    className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 flex items-center gap-2 ${formData.specialties.includes(s)
                                                        ? isFormationMode
                                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 transform scale-105'
                                                            : 'bg-amber-100 text-amber-700 border-amber-200'
                                                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {isFormationMode && getSubjectIcon(s)}
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {!isFormationMode && (
                                    <div className="col-span-2">
                                        <label className="label font-bold text-blue-700 dark:text-yellow-400 mb-2 block">Niveaux</label>
                                        <div className="flex flex-wrap gap-2">
                                            {NIVEAUX_SCOLAIRE.map(n => (
                                                <button
                                                    key={n.key}
                                                    type="button"
                                                    onClick={() => toggleSelection('levels', n.key)}
                                                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${formData.levels.includes(n.key)
                                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {n.nameKey}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                                <Button type="button" onClick={() => setIsModalOpen(false)} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">Annuler</Button>
                                <Button type="submit" className={`${buttonClass}`}>Enregistrer</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .label { @apply block text-sm font-medium text-gray-700 mb-1; }
                .input { @apply w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all; }
            `}</style>
        </div>
    );
};

export default function TeachersPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <TeachersContent />
        </Suspense>
    );
}
