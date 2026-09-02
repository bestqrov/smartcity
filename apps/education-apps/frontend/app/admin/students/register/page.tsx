'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import api from '@/lib/api';
import Button from '@/components/Button';
import Input from '@/components/Input';
import {
    ArrowLeft,
    Save,
    Printer,
    User,
    Calendar,
    MapPin,
    Users,
    Phone,
    CreditCard,
    GraduationCap,
    BookOpen,
    Calculator,
    ShoppingCart,
    CheckCircle
} from 'lucide-react';

export default function RegisterStudentPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const { profile } = useSchoolProfile();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '', // NOM
        surname: '', // PRENOM
        birthDate: '',
        birthPlace: '',
        fatherName: '',
        motherName: '',
        cin: '',
        address: '',
        phone: '',
        schoolLevel: '',
        currentSchool: '',
    });

    const [subjects, setSubjects] = useState({
        maths: false,
        physique: false,
        svt: false,
        francais_comm: false,
        francais_soutien: false,
        anglais_comm: false,
        anglais_soutien: false,
        allemande_comm: false,
        allemande_soutien: false,
        espagnole_comm: false,
        espagnole_soutien: false,
        calcul_mental: false,
        couran: false,
        autre: false,
    });

    const [inscriptionFee, setInscriptionFee] = useState(50);

    // Subject prices
    const subjectPrices: Record<string, number> = {
        maths: 100,
        physique: 100,
        svt: 100,
        francais_comm: 80,
        francais_soutien: 100,
        anglais_comm: 80,
        anglais_soutien: 100,
        allemande_comm: 80,
        allemande_soutien: 100,
        espagnole_comm: 80,
        espagnole_soutien: 100,
        calcul_mental: 50,
        couran: 60,
        autre: 50,
    };

    // Get selected subjects with prices
    const getSelectedSubjects = () => {
        return Object.entries(subjects)
            .filter(([_, isSelected]) => isSelected)
            .map(([key]) => ({
                name: key.replace('_', ' ').toUpperCase(),
                price: subjectPrices[key] || 0
            }));
    };

    // Calculate subtotal for subjects
    const calculateSubjectsTotal = () => {
        return Object.entries(subjects).reduce((total, [key, isSelected]) => {
            return isSelected ? total + (subjectPrices[key] || 0) : total;
        }, 0);
    };

    // Calculate total
    const calculateTotal = () => {
        return inscriptionFee + calculateSubjectsTotal();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setSubjects((prev) => ({ ...prev, [name]: checked }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const studentData = {
                ...formData,
                subjects: subjects,
                inscriptionFee: inscriptionFee,
                amountPaid: calculateTotal()
            };

            await api.post('/students', studentData);
            router.push('/admin/students');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to register student');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const selectedSubjects = getSelectedSubjects();
    const subjectsTotal = calculateSubjectsTotal();
    const total = calculateTotal();

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4 print:p-0 print:bg-white">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header Actions */}
                <div className="flex items-center justify-between print:hidden">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        className="flex items-center gap-2 bg-white hover:bg-gray-50"
                    >
                        <ArrowLeft size={16} /> Retour
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handlePrint} className="flex items-center gap-2 bg-white hover:bg-gray-50">
                            <Printer size={16} /> Imprimer
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form - Left Side */}
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSubmit} className="bg-white p-8 shadow-xl rounded-2xl border border-green-100">

                            {/* Header Section */}
                            <div className="text-center mb-8 space-y-2 border-b-2 border-green-600 pb-6">
                                <div className="flex justify-between text-sm font-bold text-gray-700">
                                    <span>Le : {new Date().toLocaleDateString()}</span>
                                    <span>ROYAUME DU MAROC</span>
                                </div>
                                <h2 className="font-bold text-lg text-gray-800">MINISTERE D'EDUCATION NATIONALE</h2>
                                <h1 className="font-bold text-3xl tracking-wider text-green-700">{profile?.schoolName || 'Smart School'}</h1>
                                <div className="mt-4 inline-block border-2 border-green-600 px-6 py-3 font-bold text-lg bg-green-50 rounded-lg">
                                    Fiche de renseignements individuelle
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 print:hidden border border-red-200">
                                    {error}
                                </div>
                            )}

                            {/* Personal Information */}
                            <div className="space-y-6 mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <User className="text-blue-600" size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">Informations Personnelles</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <Input
                                        label={<span>PRENOM <span className="text-red-500">*</span></span>}
                                        name="surname"
                                        value={formData.surname}
                                        onChange={handleChange}
                                        required
                                        placeholder="Prénom de l'étudiant"
                                    />
                                    <Input
                                        label={<span>NOM <span className="text-red-500">*</span></span>}
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        placeholder="Nom de famille"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <Input
                                        label="Date de naissance"
                                        name="birthDate"
                                        type="date"
                                        value={formData.birthDate}
                                        onChange={handleChange}
                                    />
                                    <Input
                                        label="Lieu de naissance"
                                        name="birthPlace"
                                        value={formData.birthPlace}
                                        onChange={handleChange}
                                        placeholder="Ville de naissance"
                                    />
                                </div>

                                <div className="flex items-center gap-3 mb-4 mt-8">
                                    <div className="bg-purple-100 p-2 rounded-lg">
                                        <Users className="text-purple-600" size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">Parents</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <Input
                                        label="Fille ou fils de"
                                        name="fatherName"
                                        value={formData.fatherName}
                                        onChange={handleChange}
                                        placeholder="Nom du père"
                                    />
                                    <Input
                                        label="Et de"
                                        name="motherName"
                                        value={formData.motherName}
                                        onChange={handleChange}
                                        placeholder="Nom de la mère"
                                    />
                                </div>

                                <div className="flex items-center gap-3 mb-4 mt-8">
                                    <div className="bg-orange-100 p-2 rounded-lg">
                                        <MapPin className="text-orange-600" size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">Coordonnées</h3>
                                </div>

                                <Input
                                    label="Numéro du CIN"
                                    name="cin"
                                    value={formData.cin}
                                    onChange={handleChange}
                                    placeholder="Numéro de carte d'identité"
                                />

                                <Input
                                    label="Adresse des parents"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Adresse complète"
                                />

                                <Input
                                    label="Numéro de téléphone (Mobile)"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="06XXXXXXXX"
                                />

                                <div className="flex items-center gap-3 mb-4 mt-8">
                                    <div className="bg-green-100 p-2 rounded-lg">
                                        <GraduationCap className="text-green-600" size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">Scolarité</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Niveau scolaire
                                        </label>
                                        <select
                                            name="schoolLevel"
                                            value={formData.schoolLevel}
                                            onChange={(e) => setFormData(prev => ({ ...prev, schoolLevel: e.target.value }))}
                                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                                        >
                                            <option value="">Sélectionner un niveau</option>
                                            <option value="Primaire">Primaire</option>
                                            <option value="Collège">Collège</option>
                                            <option value="Lycée">Lycée</option>
                                        </select>
                                    </div>
                                    <Input
                                        label="Nom de l'Ecole pour les étudiants"
                                        name="currentSchool"
                                        value={formData.currentSchool}
                                        onChange={handleChange}
                                        placeholder="Nom de l'établissement"
                                    />
                                </div>
                            </div>

                            {/* Courses Section */}
                            <div className="border-t-2 border-green-200 pt-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-indigo-100 p-2 rounded-lg">
                                        <BookOpen className="text-indigo-600" size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">Les Cours de Soutien</h3>
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-green-100 to-emerald-100">
                                                <th className="border border-gray-200 p-3 text-left font-bold text-gray-700">Matières</th>
                                                <th className="border border-gray-200 p-3 text-center font-bold text-gray-700">OUI</th>
                                                <th className="border border-gray-200 p-3 text-center font-bold text-gray-700">NON</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {/* Scientific Subjects */}
                                            <tr className="bg-blue-50">
                                                <td className="border border-gray-200 p-3 font-bold text-blue-800" colSpan={3}>
                                                    📐 LES Matières scientifique
                                                </td>
                                            </tr>
                                            {[
                                                { label: 'Maths', key: 'maths' },
                                                { label: 'Physique et Chimique', key: 'physique' },
                                                { label: 'S.V.T', key: 'svt' },
                                            ].map((subject) => (
                                                <tr key={subject.key} className="hover:bg-gray-50 transition-colors">
                                                    <td className="border border-gray-200 p-3 pl-8">- {subject.label}</td>
                                                    <td className="border border-gray-200 p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            name={subject.key}
                                                            checked={subjects[subject.key as keyof typeof subjects]}
                                                            onChange={handleSubjectChange}
                                                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                                        />
                                                    </td>
                                                    <td className="border border-gray-200 p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!subjects[subject.key as keyof typeof subjects]}
                                                            readOnly
                                                            className="w-5 h-5 opacity-30"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Languages */}
                                            <tr className="bg-purple-50">
                                                <td className="border border-gray-200 p-3 font-bold text-purple-800" colSpan={3}>
                                                    🌍 les langues
                                                </td>
                                            </tr>

                                            <tr className="bg-gray-50">
                                                <td className="border border-gray-200 p-3"></td>
                                                <td className="border border-gray-200 p-3 text-center text-xs font-bold text-gray-600">COMMUNICATION</td>
                                                <td className="border border-gray-200 p-3 text-center text-xs font-bold text-gray-600">SOUTIEN</td>
                                            </tr>

                                            {[
                                                { label: 'Français', key: 'francais' },
                                                { label: 'Anglais', key: 'anglais' },
                                                { label: 'Allemande', key: 'allemande' },
                                                { label: 'Espagnole', key: 'espagnole' },
                                            ].map((lang) => (
                                                <tr key={lang.key} className="hover:bg-gray-50 transition-colors">
                                                    <td className="border border-gray-200 p-3 pl-8">- {lang.label}</td>
                                                    <td className="border border-gray-200 p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            name={`${lang.key}_comm`}
                                                            checked={subjects[`${lang.key}_comm` as keyof typeof subjects]}
                                                            onChange={handleSubjectChange}
                                                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                                        />
                                                    </td>
                                                    <td className="border border-gray-200 p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            name={`${lang.key}_soutien`}
                                                            checked={subjects[`${lang.key}_soutien` as keyof typeof subjects]}
                                                            onChange={handleSubjectChange}
                                                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}

                                            {/* Other */}
                                            <tr className="bg-orange-50">
                                                <td className="border border-gray-200 p-3 font-bold text-orange-800" colSpan={3}>
                                                    ✨ Autre
                                                </td>
                                            </tr>
                                            {[
                                                { label: 'Calcul Mental', key: 'calcul_mental' },
                                                { label: 'Coran', key: 'couran' },
                                                { label: 'Autre', key: 'autre' },
                                            ].map((item) => (
                                                <tr key={item.key} className="hover:bg-gray-50 transition-colors">
                                                    <td className="border border-gray-200 p-3 pl-8">- {item.label}</td>
                                                    <td className="border border-gray-200 p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            name={item.key}
                                                            checked={subjects[item.key as keyof typeof subjects]}
                                                            onChange={handleSubjectChange}
                                                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                                        />
                                                    </td>
                                                    <td className="border border-gray-200 p-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={!subjects[item.key as keyof typeof subjects]}
                                                            readOnly
                                                            className="w-5 h-5 opacity-30"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end print:hidden">
                                <Button type="submit" isLoading={loading} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg">
                                    <Save size={20} /> Enregistrer l'inscription
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Shopping Cart / Checkout - Right Side */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-xl border border-green-100 p-6 sticky top-4">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-green-200">
                                <div className="bg-green-100 p-2 rounded-lg">
                                    <ShoppingCart className="text-green-600" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Récapitulatif</h3>
                            </div>

                            {/* Inscription Fee */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="text-blue-500" size={18} />
                                        <span className="font-semibold text-gray-700">Frais d'inscription</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={inscriptionFee}
                                        onChange={(e) => setInscriptionFee(Number(e.target.value))}
                                        className="flex-1 px-4 py-2 border-2 border-green-200 rounded-lg text-right font-bold text-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                    />
                                    <span className="font-bold text-gray-700">DH</span>
                                </div>
                            </div>

                            {/* Selected Subjects */}
                            <div className="mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <Calculator className="text-purple-500" size={18} />
                                    <span className="font-semibold text-gray-700">Matières sélectionnées</span>
                                </div>

                                {selectedSubjects.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <BookOpen size={48} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">Aucune matière sélectionnée</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {selectedSubjects.map((subject, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="text-green-600" size={16} />
                                                    <span className="text-sm font-medium text-gray-700">{subject.name}</span>
                                                </div>
                                                <span className="font-bold text-green-700">{subject.price} DH</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Subtotal */}
                            {selectedSubjects.length > 0 && (
                                <div className="flex items-center justify-between py-3 border-t border-gray-200">
                                    <span className="text-gray-600 font-medium">Sous-total matières:</span>
                                    <span className="font-bold text-gray-800">{subjectsTotal} DH</span>
                                </div>
                            )}

                            {/* Total */}
                            <div className="mt-6 pt-6 border-t-2 border-green-300">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xl font-bold text-gray-800">Total à payer:</span>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-green-600">{total}</div>
                                        <div className="text-sm text-gray-500 font-semibold">DH</div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Info */}
                            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs text-blue-800 text-center">
                                    💳 Le paiement sera effectué lors de la validation de l'inscription
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
