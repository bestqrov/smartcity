'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker'; // Assuming this exists or generic input
import { createStudent, updateStudent } from '@/lib/services/students';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { Users, Phone, MapPin, Calendar, CreditCard } from 'lucide-react';

interface AddStudentFormProps {
    onSuccess: () => void;
    initialData?: any;
}

export default function AddStudentForm({ onSuccess, initialData }: AddStudentFormProps) {
    const { profile } = useSchoolProfile();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        surname: '', // Using surname/name split if API expects it, or just name if unified
        email: '',
        phone: '',
        cin: '', // ID Card
        address: '',
        birthDate: '',
        schoolLevel: 'LYCEE', // Default
        parentName: '',
        parentPhone: '',
        parentRelation: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                surname: initialData.surname || '',
                email: initialData.email || '',
                phone: initialData.phone || '',
                cin: initialData.cin || '',
                address: initialData.address || '',
                birthDate: initialData.birthDate ? new Date(initialData.birthDate).toISOString().split('T')[0] : '',
                schoolLevel: initialData.schoolLevel || 'LYCEE',
                parentName: initialData.parentName || '',
                parentPhone: initialData.parentPhone || '',
                parentRelation: initialData.parentRelation || ''
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData?.id) {
                await updateStudent(initialData.id, formData);
            } else {
                await createStudent(formData);
            }
            onSuccess();
        } catch (error) {
            console.error('Failed to save student', error);
            alert('Une erreur est survenue lors de l\'enregistrement.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Branded Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white shadow-xl">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                <Users size={24} className="text-white" />
                            </div>
                            <span className="font-bold tracking-wider text-blue-100 uppercase text-xs">Portail Inscriptions</span>
                        </div>
                        <h2 className="text-3xl font-extrabold flex items-center gap-3">
                            {initialData ? 'Modification Dossier' : 'Nouvelle Inscription'}
                            <span className="text-blue-200/50 text-xl font-light">|</span>
                            <span className="text-white/90">{profile?.schoolName || 'Smart School'}</span>
                        </h2>
                        <p className="text-blue-100/80 mt-2 text-sm max-w-md">
                            Gérez les informations académiques et personnelles de l'élève avec précision et simplicité.
                        </p>
                    </div>
                    <div className="hidden md:block opacity-20 transform rotate-12 scale-150">
                        <Users size={120} />
                    </div>
                </div>
                {/* Abstract Background Shapes */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Info Card - Blue Theme */}
                <div className="group bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 group-hover:w-2 transition-all"></div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">État Civil</h3>
                            <p className="text-sm text-slate-500">Informations de base de l'élève</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Nom</label>
                            <Input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="ex: Ahmed"
                                required
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Prénom</label>
                            <Input
                                name="surname"
                                value={formData.surname}
                                onChange={handleChange}
                                placeholder="ex: Benali"
                                required
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1 flex items-center gap-2">
                                <Calendar size={14} className="text-blue-400" />
                                Date de Naissance
                            </label>
                            <Input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleChange}
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1 flex items-center gap-2">
                                <CreditCard size={14} className="text-blue-400" />
                                CIN (Optionnel)
                            </label>
                            <Input
                                name="cin"
                                value={formData.cin}
                                onChange={handleChange}
                                placeholder="ex: AB123456"
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Email de l'élève</label>
                            <Input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="etudiant@smartecole.com"
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Academic & Location Card - Emerald Theme */}
                <div className="group bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 group-hover:w-2 transition-all"></div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                            <MapPin size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Scolarité & Contact</h3>
                            <p className="text-sm text-slate-500">Détails académiques et adresse</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Niveau Scolaire</label>
                            <select
                                name="schoolLevel"
                                value={formData.schoolLevel}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                            >
                                <option value="PRIMAIRE">Primaire</option>
                                <option value="COLLEGE">Collège</option>
                                <option value="LYCEE">Lycée</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1 flex items-center gap-2">
                                <Phone size={14} className="text-emerald-400" />
                                Téléphone Élève
                            </label>
                            <Input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="06 00 00 00 00"
                                className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Adresse Domicile</label>
                            <Input
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="ex: N°12 Rue Al Amal, Casablanca"
                                className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Parent/Guardian Card - Amber Theme */}
                <div className="group bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 group-hover:w-2 transition-all"></div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Tuteur Légal</h3>
                            <p className="text-sm text-slate-500">Informations du parent ou tuteur</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Nom du Parent</label>
                            <Input
                                name="parentName"
                                value={formData.parentName}
                                onChange={handleChange}
                                placeholder="Nom et Prénom du tuteur"
                                required
                                className="rounded-xl border-slate-200 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1">Lien de parenté</label>
                            <select
                                name="parentRelation"
                                value={(formData as any).parentRelation || ''}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium text-slate-700"
                            >
                                <option value="">Sélectionner...</option>
                                <option value="PÈRE">Père</option>
                                <option value="MÈRE">Mère</option>
                                <option value="TUTEUR">Tuteur / Autre</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ml-1 flex items-center gap-2">
                                <Phone size={14} className="text-amber-400" />
                                Téléphone Parent
                            </label>
                            <Input
                                type="tel"
                                name="parentPhone"
                                value={formData.parentPhone}
                                onChange={handleChange}
                                placeholder="06 00 00 00 00"
                                required
                                className="rounded-xl border-slate-200 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-4 pt-6">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl shadow-xl shadow-blue-500/30 transition-all font-bold text-lg active:scale-95 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Enregistrement...
                            </div>
                        ) : (
                            initialData ? 'Mettre à jour le dossier' : 'Confirmer l\'inscription'
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
