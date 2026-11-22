'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker'; // Assuming this exists or generic input
import { createStudent, updateStudent } from '@/lib/services/students';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import { Users, Phone, MapPin, Calendar, CreditCard } from 'lucide-react';

import { useI18n } from '@/lib/i18n/I18nProvider';
interface AddStudentFormProps {
    onSuccess: () => void;
    initialData?: any;
}

export default function AddStudentForm({ onSuccess, initialData }: AddStudentFormProps) {
    const { tr } = useI18n();
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
        parentRelation: '',
        crecheSection: '',
        healthNotes: '',
        massarNumber: ''
    });
    const [authorizedPickup, setAuthorizedPickup] = useState<{ name: string; phone: string; relation: string }[]>([]);
    const [inscriptionFee, setInscriptionFee] = useState<string>('');
    const [monthlyFee, setMonthlyFee] = useState<string>('');
    const [amountPaid, setAmountPaid] = useState<string>('');
    const institutionType = profile.institutionType;

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
                parentRelation: initialData.parentRelation || '',
                crecheSection: initialData.crecheSection || '',
                healthNotes: initialData.healthNotes || '',
                massarNumber: initialData.massarNumber || ''
            });
            setAuthorizedPickup(initialData.authorizedPickup || []);
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const addPickupPerson = () => setAuthorizedPickup((prev) => [...prev, { name: '', phone: '', relation: '' }]);
    const removePickupPerson = (index: number) => setAuthorizedPickup((prev) => prev.filter((_, i) => i !== index));
    const updatePickupPerson = (index: number, field: 'name' | 'phone' | 'relation', value: string) =>
        setAuthorizedPickup((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const feePayload: any = {};
            if (institutionType === 'CRECHE' && !initialData) {
                feePayload.schoolLevel = 'Crèche';
                if (inscriptionFee) feePayload.inscriptionFee = Number(inscriptionFee) || 0;
                if (monthlyFee) feePayload.subjectsTotal = Number(monthlyFee) || 0;
                if (amountPaid && Number(amountPaid) > 0) feePayload.amountPaid = Number(amountPaid);
            }
            const payload: any = { ...formData, ...(institutionType === 'CRECHE' ? { authorizedPickup } : {}), ...feePayload };
            if (initialData?.id) {
                await updateStudent(initialData.id, payload);
            } else {
                await createStudent(payload);
            }
            onSuccess();
        } catch (error: any) {
            console.error('Failed to save student', error);
            alert(error?.response?.data?.error || error?.message || tr("Une erreur est survenue lors de l'enregistrement."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Branded Header */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 p-4 sm:p-8 text-white shadow-xl">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                <Users size={24} className="text-white" />
                            </div>
                            <span className="font-bold tracking-wider text-blue-100 uppercase text-xs">{tr("Portail Inscriptions")}</span>
                        </div>
                        <h2 className="text-3xl font-extrabold flex items-center gap-3">
                            {initialData ? tr("Modification Dossier") : tr("Nouvelle Inscription")}
                            <span className="text-blue-200/50 text-xl font-light">|</span>
                            <span className="text-white/90">{profile?.schoolName || tr("ArwaEduc")}</span>
                        </h2>
                        <p className="text-blue-100/80 mt-2 text-sm max-w-md">{tr("Gérez les informations académiques et personnelles de l'élève avec précision et simplicité.")}</p>
                    </div>
                    <div className="hidden md:block opacity-20 transform rotate-12 scale-150">
                        <Users size={120} />
                    </div>
                </div>
                {/* Abstract Background Shapes */}
                <div className="absolute top-0 end-0 -me-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 start-0 -ms-20 -mb-20 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Info Card - Blue Theme */}
                <div className="group bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 start-0 w-1.5 h-full bg-blue-500 group-hover:w-2 transition-all"></div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{tr("État Civil")}</h3>
                            <p className="text-sm text-slate-500">{tr("Informations de base de l'élève")}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1">{tr("Nom")}</label>
                            <Input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder={tr("ex: Ahmed")}
                                required
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1">{tr("Prénom")}</label>
                            <Input
                                name="surname"
                                value={formData.surname}
                                onChange={handleChange}
                                placeholder={tr("ex: Benali")}
                                required
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1 flex items-center gap-2">
                                <Calendar size={14} className="text-blue-400" />{tr("Date de Naissance")}</label>
                            <Input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleChange}
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1 flex items-center gap-2">
                                <CreditCard size={14} className="text-blue-400" />{tr("CIN (Optionnel)")}</label>
                            <Input
                                name="cin"
                                value={formData.cin}
                                onChange={handleChange}
                                placeholder={tr("ex: AB123456")}
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-bold text-slate-600 ms-1">{tr("Email de l'élève")}</label>
                            <Input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder={tr("etudiant@smartecole.com")}
                                className="rounded-xl border-slate-200 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Academic & Location Card - Emerald Theme */}
                {institutionType !== 'CRECHE' && (
                <div className="group bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 start-0 w-1.5 h-full bg-emerald-500 group-hover:w-2 transition-all"></div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                            <MapPin size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{tr("Scolarité & Contact")}</h3>
                            <p className="text-sm text-slate-500">{tr("Détails académiques et adresse")}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1">{tr("Niveau Scolaire")}</label>
                            <select
                                name="schoolLevel"
                                value={formData.schoolLevel}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                            >
                                <option value="PRIMAIRE">{tr("Primaire")}</option>
                                <option value="COLLEGE">{tr("Collège")}</option>
                                <option value="LYCEE">{tr("Lycée")}</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1 flex items-center gap-2">
                                <Phone size={14} className="text-emerald-400" />{tr("Téléphone Élève")}</label>
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
                            <label className="text-sm font-bold text-slate-600 ms-1">{tr("Adresse Domicile")}</label>
                            <Input
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder={tr("ex: N°12 Rue Al Amal, Casablanca")}
                                className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                            />
                        </div>
                    </div>
                </div>
                )}

                {institutionType === 'CRECHE' && (
                    <div className="group bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                        <div className="absolute top-0 start-0 w-1.5 h-full bg-emerald-500 group-hover:w-2 transition-all"></div>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                                <Users size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{tr("Informations de la crèche")}</h3>
                                <p className="text-sm text-slate-500">{tr("Section, santé et personnes autorisées")}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 ms-1">{tr("Section")}</label>
                                <select
                                    name="crecheSection"
                                    value={formData.crecheSection || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                                >
                                    <option value="">{tr("Sélectionner...")}</option>
                                    <option value="NOURRISSON">{tr("Nourrisson")}</option>
                                    <option value="MOYENNE">{tr("Moyenne section")}</option>
                                    <option value="GRANDE">{tr("Grande section")}</option>
                                </select>
                            </div>

                            {formData.crecheSection === 'GRANDE' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 ms-1">{tr("Numéro Massar")}</label>
                                    <Input
                                        name="massarNumber"
                                        value={formData.massarNumber || ''}
                                        onChange={handleChange}
                                        placeholder={tr("Numéro Massar (le cas échéant)")}
                                        className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                                    />
                                </div>
                            )}

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-bold text-slate-600 ms-1">{tr("Allergies / Notes de santé")}</label>
                                <textarea
                                    name="healthNotes"
                                    value={formData.healthNotes || ''}
                                    onChange={handleChange as any}
                                    rows={3}
                                    placeholder={tr("Allergies, régime alimentaire, notes de santé")}
                                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium text-slate-700"
                                />
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-slate-600">{tr("Personnes autorisées à récupérer l'enfant")}</label>
                                <button
                                    type="button"
                                    onClick={addPickupPerson}
                                    className="text-sm font-bold text-emerald-600 hover:text-emerald-700"
                                >{tr("+ Ajouter une personne")}</button>
                            </div>
                            {authorizedPickup.length === 0 && (
                                <p className="text-sm text-slate-400">{tr("Aucune personne ajoutée.")}</p>
                            )}
                            {authorizedPickup.map((person, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                                    <Input
                                        value={person.name}
                                        onChange={(e) => updatePickupPerson(index, 'name', e.target.value)}
                                        placeholder={tr("Nom")}
                                        className="rounded-xl border-slate-200 bg-slate-50/50"
                                    />
                                    <Input
                                        value={person.phone}
                                        onChange={(e) => updatePickupPerson(index, 'phone', e.target.value)}
                                        placeholder={tr("Téléphone")}
                                        className="rounded-xl border-slate-200 bg-slate-50/50"
                                    />
                                    <Input
                                        value={person.relation}
                                        onChange={(e) => updatePickupPerson(index, 'relation', e.target.value)}
                                        placeholder={tr("Lien (ex: Tante, Voisine)")}
                                        className="rounded-xl border-slate-200 bg-slate-50/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removePickupPerson(index)}
                                        className="text-sm font-bold text-red-500 hover:text-red-600 justify-self-start"
                                    >{tr("Retirer")}</button>
                                </div>
                            ))}
                        </div>

                        {!initialData && (
                        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 ms-1">{tr("Frais d'inscription (MAD)")}</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={inscriptionFee}
                                    onChange={(e) => setInscriptionFee(e.target.value)}
                                    placeholder={tr("Ex: 300")}
                                    className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 ms-1">{tr("Frais mensuel (MAD)")}</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={monthlyFee}
                                    onChange={(e) => setMonthlyFee(e.target.value)}
                                    placeholder={tr("Ex: 800")}
                                    className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-600 ms-1">{tr("Montant payé maintenant (MAD)")}</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={amountPaid}
                                    onChange={(e) => setAmountPaid(e.target.value)}
                                    placeholder="0"
                                    className="rounded-xl border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50"
                                />
                            </div>
                        </div>
                        )}
                        {!initialData && (
                        <p className="text-xs text-slate-400 mt-3">{tr("Le premier mois est inclus dans les frais dus à l'inscription (inscription + mensualité).")}</p>
                        )}
                    </div>
                )}

                {/* Parent/Guardian Card - Amber Theme */}
                <div className="group bg-white rounded-3xl p-4 sm:p-8 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                    <div className="absolute top-0 start-0 w-1.5 h-full bg-amber-500 group-hover:w-2 transition-all"></div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 group-hover:scale-110 transition-transform">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{tr("Tuteur Légal")}</h3>
                            <p className="text-sm text-slate-500">{tr("Informations du parent ou tuteur")}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1">{tr("Nom du Parent")}</label>
                            <Input
                                name="parentName"
                                value={formData.parentName}
                                onChange={handleChange}
                                placeholder={tr("Nom et Prénom du tuteur")}
                                required
                                className="rounded-xl border-slate-200 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1">{tr("Lien de parenté")}</label>
                            <select
                                name="parentRelation"
                                value={(formData as any).parentRelation || ''}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium text-slate-700"
                            >
                                <option value="">{tr("Sélectionner...")}</option>
                                <option value="PÈRE">{tr("Père")}</option>
                                <option value="MÈRE">{tr("Mère")}</option>
                                <option value="TUTEUR">{tr("Tuteur / Autre")}</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-600 ms-1 flex items-center gap-2">
                                <Phone size={14} className="text-amber-400" />{tr("Téléphone Parent")}</label>
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
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>{tr("Enregistrement...")}</div>
                        ) : (
                            initialData ? tr("Mettre à jour le dossier") : tr("Confirmer l'inscription")
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}
