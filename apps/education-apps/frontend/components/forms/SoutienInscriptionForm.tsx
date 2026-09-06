'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import api from '@/lib/api';
import Button from '@/components/Button';
import Input from '@/components/Input';
import {
    Save,
    Printer,
    User,
    MapPin,
    Users,
    CreditCard,
    GraduationCap,
    BookOpen,
    Calculator,
    ShoppingCart,
    CheckCircle
} from 'lucide-react';

interface SoutienInscriptionFormProps {
    onSuccess?: () => void;
    onSuccessRedirect?: string;
}

export default function SoutienInscriptionForm({ onSuccess, onSuccessRedirect }: SoutienInscriptionFormProps) {
    const router = useRouter();
    const { user } = useAuthStore();
    const { profile } = useSchoolProfile();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [lastRegisteredStudent, setLastRegisteredStudent] = useState<any>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        surname: '',
        birthDate: '',
        birthPlace: '',
        fatherName: '',
        motherName: '',
        cin: '',
        address: '',
        phone: '',
        parentName: '',
        parentPhone: '',
        parentRelation: '',
        schoolLevel: '',
        currentSchool: '',
    });

    const [subjects, setSubjects] = useState<Record<string, number>>({});

    const [inscriptionFee, setInscriptionFee] = useState(100);

    // Dynamic subjects list from backend (price is now ignored/manual)
    const [availableSubjectsByLevel, setAvailableSubjectsByLevel] = useState<Record<string, Array<{ key: string, label: string, category: string, price: number }>>>({});

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const response = await api.get('/pricing');
                if (response.data.success) {
                    const pricingData = response.data.data;
                    const newSubjects: Record<string, Array<{ key: string, label: string, category: string, price: number }>> = {};

                    console.log("Pricing API response:", response.data);
                    pricingData.forEach((item: any) => {
                        if (item.category !== 'SOUTIEN') return;

                        const levelRaw = item.level;
                        let level = levelRaw;

                        // Normalize DB level names to Frontend codes
                        if (levelRaw === 'Lycée') level = 'LYCEE';
                        else if (levelRaw === 'Collège') level = 'COLLEGE';
                        else if (levelRaw === 'Primaire') level = 'PRIMAIRE';

                        if (!newSubjects[level]) {
                            newSubjects[level] = [];
                        }

                        // Normalize key
                        const key = item.subject
                            .toLowerCase()
                            .normalize("NFD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .replace(/\s+/g, '_');

                        // Determine category for UI grouping
                        let category = 'other';
                        const lowerSub = item.subject.toLowerCase();
                        if (['maths', 'physique', 'svt', 'sciences'].some(s => lowerSub.includes(s))) {
                            category = 'scientific';
                        } else if (['francais', 'anglais', 'arabe', 'espagnole', 'allemande'].some(s => lowerSub.includes(s))) {
                            category = 'language';
                        }

                        newSubjects[level].push({
                            key: key,
                            label: item.subject,
                            category: category,
                            price: item.price || 0
                        });
                    });
                    console.log("Processed Subjects:", newSubjects);
                    setAvailableSubjectsByLevel(newSubjects);
                }
            } catch (error) {
                console.error("Failed to fetch subjects:", error);
            }
        };

        fetchSubjects();
    }, []);

    const getAvailableSubjects = () => {
        const level = formData.schoolLevel;
        if (!level || !availableSubjectsByLevel[level]) return [];
        return availableSubjectsByLevel[level];
    };

    const getSelectedSubjects = () => {
        const level = formData.schoolLevel;
        if (!level) return [];

        return Object.entries(subjects)
            .map(([key, price]) => {
                const subjectList = availableSubjectsByLevel[level] || [];
                const subjectInfo = subjectList.find(s => s.key === key);
                return {
                    name: subjectInfo ? subjectInfo.label : key.replace('_', ' ').toUpperCase(),
                    price: price
                };
            });
    };

    const calculateSubjectsTotal = () => {
        return Object.values(subjects).reduce((total, price) => total + price, 0);
    };

    const calculateTotal = () => {
        return inscriptionFee + calculateSubjectsTotal();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubjectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setSubjects((prev) => {
            if (checked) {
                // Find default price
                let defaultPrice = 0;
                if (formData.schoolLevel && availableSubjectsByLevel[formData.schoolLevel]) {
                    const subject = availableSubjectsByLevel[formData.schoolLevel].find(s => s.key === name);
                    if (subject) defaultPrice = subject.price;
                }
                return { ...prev, [name]: defaultPrice };
            } else {
                const { [name]: removed, ...rest } = prev;
                return rest;
            }
        });
    };

    const handlePriceChange = (subjectKey: string, price: string) => {
        const value = parseFloat(price);
        setSubjects((prev) => ({
            ...prev,
            [subjectKey]: isNaN(value) ? 0 : value
        }));
    };

    const handlePrint = () => {
        if (!lastRegisteredStudent) return;

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const currentDate = new Date().toLocaleDateString('fr-FR');
        const receiptNo = `RCPT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reçu - ${lastRegisteredStudent.name} ${lastRegisteredStudent.surname}</title>
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        font-family: monospace;
                        font-size: 12px;
                        width: 80mm;
                        margin: 0;
                        padding: 10mm;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .header { font-size: 18px; margin-bottom: 5px; }
                    .small { font-size: 10px; }
                    .medium { font-size: 11px; }
                    .title { font-size: 14px; margin: 15px 0; }
                    .dashed { border-top: 1px dashed #000; margin: 10px 0; }
                    .flex { display: flex; justify-content: space-between; }
                    .mt-20 { margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="center header bold">${profile?.schoolName || 'Smart School'}</div>
                ${profile?.address ? `<div class="center small">${profile.address}</div>` : ''}
                ${profile?.phone ? `<div class="center small">Tél: ${profile.phone}</div>` : ''}
                
                <div class="center title bold">Reçu Soutien</div>
                <div class="dashed"></div>
                
                <div class="flex medium">
                    <span>Date: ${currentDate}</span>
                    <span>Reçu No: ${receiptNo}</span>
                </div>
                <div class="dashed"></div>
                
                <div class="medium">
                    <div>Client: ${lastRegisteredStudent.name} ${lastRegisteredStudent.surname}</div>
                    <div>Tél: ${lastRegisteredStudent.phone}</div>
                    <div>Paiement: Cash</div>
                </div>
                <div class="dashed"></div>
                
                <div class="flex bold medium">
                    <span>Description</span>
                    <span>Montant</span>
                </div>
                
                <div class="medium">
                    <div class="flex">
                        <span>May Tuition Fee</span>
                        <span>${lastRegisteredStudent.subjectsTotal.toFixed(2)} MAD</span>
                    </div>
                </div>
                <div class="dashed"></div>
                
                <div class="medium">
                    <div class="flex"><span>Total:</span><span class="bold">${lastRegisteredStudent.total.toFixed(2)} MAD</span></div>
                    <div class="flex"><span>Payé:</span><span class="bold">${lastRegisteredStudent.total.toFixed(2)} MAD</span></div>
                    <div class="flex"><span>Reste:</span><span class="bold">0,00 MAD</span></div>
                </div>
                
                <div class="center medium mt-20">Merci pour votre visite!</div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setRegistrationSuccess(false);

        try {
            const response = await api.post('/students', {
                ...formData,
                subjects: subjects,
                inscriptionFee: inscriptionFee,
                subjectsTotal: calculateSubjectsTotal(),
                amountPaid: total,
            });

            setLastRegisteredStudent({
                name: formData.name,
                surname: formData.surname,
                phone: formData.phone,
                parentName: formData.parentName,
                parentPhone: formData.parentPhone,
                parentRelation: formData.parentRelation,
                inscriptionFee,
                subjectsTotal: calculateSubjectsTotal(),
                total,
            });
            setRegistrationSuccess(true);
            setShowSuccessModal(true);
        } catch (err: any) {
            console.error('Student creation error:', err);
            if (err.response) {
                const status = err.response.status;
                const message = err.response.data?.message || err.response.data?.error;

                if (status === 401) {
                    setError('Session expired. Please login again.');
                } else if (status === 403) {
                    setError('You do not have permission to create students.');
                } else if (status === 400) {
                    setError(message || 'Invalid data. Please check all fields.');
                } else {
                    setError(message || `Server error (${status}). Please try again.`);
                }
            } else if (err.request) {
                setError('Cannot connect to server. Please check if the backend is running.');
            } else {
                setError(err.message || 'An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSuccessOk = () => {
        setShowSuccessModal(false);
        if (onSuccess) onSuccess();
        if (onSuccessRedirect) router.push(onSuccessRedirect);
    };

    const handleSuccessPrint = () => {
        handlePrint();
    };

    const selectedSubjects = getSelectedSubjects();
    const subjectsTotal = calculateSubjectsTotal();
    const total = calculateTotal();

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4 print:p-0 print:bg-white">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSubmit} className="bg-white p-8 shadow-xl rounded-2xl border border-green-100">
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

                            <div className="space-y-6 mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <User className="text-blue-600" size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">Informations Personnelles</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <Input
                                        label="PRENOM *"
                                        name="surname"
                                        value={formData.surname}
                                        onChange={handleChange}
                                        required
                                        placeholder="Prénom de l'étudiant"
                                    />
                                    <Input
                                        label="NOM *"
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
                                        label="Nom du Parent (Tuteur) *"
                                        name="parentName"
                                        value={formData.parentName}
                                        onChange={handleChange}
                                        required
                                        placeholder="Nom Complet"
                                    />
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Lien de parenté *
                                        </label>
                                        <select
                                            name="parentRelation"
                                            value={formData.parentRelation}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors"
                                        >
                                            <option value="">Sélectionner...</option>
                                            <option value="PÈRE">Père</option>
                                            <option value="MÈRE">Mère</option>
                                            <option value="TUTEUR">Tuteur / Autre</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mt-4">
                                    <Input
                                        label="Téléphone Parent *"
                                        name="parentPhone"
                                        value={formData.parentPhone}
                                        onChange={handleChange}
                                        required
                                        placeholder="06XXXXXXXX"
                                    />
                                    <Input
                                        label="Fille ou fils de"
                                        name="fatherName"
                                        value={formData.fatherName}
                                        onChange={handleChange}
                                        placeholder="Nom du père"
                                    />
                                </div>

                                <Input
                                    label="Et de"
                                    name="motherName"
                                    value={formData.motherName}
                                    onChange={handleChange}
                                    placeholder="Nom de la mère"
                                    className="mt-4"
                                />

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
                                            <option value="PRIMAIRE">Primaire</option>
                                            <option value="COLLEGE">Collège</option>
                                            <option value="LYCEE">Lycée</option>
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

                            <div className="border-t-2 border-green-200 pt-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="bg-indigo-100 p-2 rounded-lg">
                                        <BookOpen className="text-indigo-600" size={24} />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800">Les Cours de Soutien</h3>
                                </div>

                                {!formData.schoolLevel ? (
                                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
                                        <BookOpen className="mx-auto text-yellow-400 mb-3" size={48} />
                                        <p className="text-yellow-700 font-medium">
                                            Veuillez d'abord sélectionner le niveau scolaire pour activer la sélection des cours
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-green-100 to-emerald-100">
                                                    <th className="border border-gray-200 p-3 text-left font-bold text-gray-700">Matières</th>
                                                    <th className="border border-gray-200 p-3 text-center font-bold text-gray-700">Sélection</th>
                                                    <th className="border border-gray-200 p-3 text-center font-bold text-gray-700 w-40">Prix (DH)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                                {(() => {
                                                    const availableSubjects = getAvailableSubjects();
                                                    const scientificSubjects = availableSubjects.filter(s => s.category === 'scientific');
                                                    const languageSubjects = availableSubjects.filter(s => s.category === 'language');
                                                    const otherSubjects = availableSubjects.filter(s => s.category === 'other');

                                                    return (
                                                        <>
                                                            {scientificSubjects.length > 0 && (
                                                                <>
                                                                    <tr className="bg-blue-50">
                                                                        <td className="border border-gray-200 p-3 font-bold text-blue-800" colSpan={3}>
                                                                            📐 LES Matières scientifiques
                                                                        </td>
                                                                    </tr>
                                                                    {scientificSubjects.map((subject) => (
                                                                        <tr key={subject.key} className="hover:bg-gray-50 transition-colors">
                                                                            <td className="border border-gray-200 p-3 pl-8">- {subject.label}</td>
                                                                            <td className="border border-gray-200 p-3 text-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    name={subject.key}
                                                                                    checked={subjects[subject.key] !== undefined}
                                                                                    onChange={handleSubjectChange}
                                                                                    className="w-6 h-6 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                                                                                />
                                                                            </td>
                                                                            <td className="border border-gray-200 p-3 text-center">
                                                                                <input
                                                                                    type="number"
                                                                                    value={subjects[subject.key] !== undefined ? subjects[subject.key] : ''}
                                                                                    onChange={(e) => handlePriceChange(subject.key, e.target.value)}
                                                                                    disabled={subjects[subject.key] === undefined}
                                                                                    placeholder="0"
                                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:border-green-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </>
                                                            )}

                                                            {languageSubjects.length > 0 && (
                                                                <>
                                                                    <tr className="bg-purple-50">
                                                                        <td className="border border-gray-200 p-3 font-bold text-purple-800" colSpan={3}>
                                                                            🌍 Les Langues
                                                                        </td>
                                                                    </tr>
                                                                    {languageSubjects.map((subject) => (
                                                                        <tr key={subject.key} className="hover:bg-gray-50 transition-colors">
                                                                            <td className="border border-gray-200 p-3 pl-8">- {subject.label}</td>
                                                                            <td className="border border-gray-200 p-3 text-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    name={subject.key}
                                                                                    checked={subjects[subject.key] !== undefined}
                                                                                    onChange={handleSubjectChange}
                                                                                    className="w-6 h-6 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                                                                                />
                                                                            </td>
                                                                            <td className="border border-gray-200 p-3 text-center">
                                                                                <input
                                                                                    type="number"
                                                                                    value={subjects[subject.key] !== undefined ? subjects[subject.key] : ''}
                                                                                    onChange={(e) => handlePriceChange(subject.key, e.target.value)}
                                                                                    disabled={subjects[subject.key] === undefined}
                                                                                    placeholder="0"
                                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:border-green-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </>
                                                            )}

                                                            {otherSubjects.length > 0 && (
                                                                <>
                                                                    <tr className="bg-orange-50">
                                                                        <td className="border border-gray-200 p-3 font-bold text-orange-800" colSpan={3}>
                                                                            ✨ Autre
                                                                        </td>
                                                                    </tr>
                                                                    {otherSubjects.map((subject) => (
                                                                        <tr key={subject.key} className="hover:bg-gray-50 transition-colors">
                                                                            <td className="border border-gray-200 p-3 pl-8">- {subject.label}</td>
                                                                            <td className="border border-gray-200 p-3 text-center">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    name={subject.key}
                                                                                    checked={subjects[subject.key] !== undefined}
                                                                                    onChange={handleSubjectChange}
                                                                                    className="w-6 h-6 text-green-600 rounded focus:ring-green-500 cursor-pointer"
                                                                                />
                                                                            </td>
                                                                            <td className="border border-gray-200 p-3 text-center">
                                                                                <input
                                                                                    type="number"
                                                                                    value={subjects[subject.key] !== undefined ? subjects[subject.key] : ''}
                                                                                    onChange={(e) => handlePriceChange(subject.key, e.target.value)}
                                                                                    disabled={subjects[subject.key] === undefined}
                                                                                    placeholder="0"
                                                                                    className="w-full px-2 py-1 border border-gray-300 rounded text-right focus:border-green-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex gap-4 print:hidden">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Save size={20} /> Enregistrer l'inscription
                                </Button>
                            </div>
                        </form>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-xl border border-green-100 p-6 sticky top-4">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-green-200">
                                <div className="bg-green-100 p-2 rounded-lg">
                                    <ShoppingCart className="text-green-600" size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Récapitulatif</h3>
                            </div>

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
                                        className="w-32 px-3 py-2 border-2 border-green-200 rounded-lg text-right font-bold focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                    />
                                    <span className="font-bold text-gray-700">DH</span>
                                </div>
                            </div>

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

                            {selectedSubjects.length > 0 && (
                                <div className="flex items-center justify-between py-3 border-t border-gray-200">
                                    <span className="text-gray-600 font-medium">Sous-total matières:</span>
                                    <span className="font-bold text-gray-800">{subjectsTotal} DH</span>
                                </div>
                            )}

                            <div className="mt-6 pt-6 border-t-2 border-green-300">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xl font-bold text-gray-800">Total à payer:</span>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-green-600">{total}</div>
                                        <div className="text-sm text-gray-500 font-semibold">DH</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-xs text-blue-800 text-center">
                                    💳 Le paiement sera effectué lors de la validation de l'inscription
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {showSuccessModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                            <div className="text-center mb-6">
                                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="text-green-600" size={32} />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enregistré avec succès!</h2>
                                <p className="text-gray-600">L'inscription a été enregistrée avec succès.</p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={handleSuccessPrint}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                                >
                                    <Printer size={18} /> Imprimer
                                </Button>
                                <Button
                                    onClick={handleSuccessOk}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                >
                                    OK
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
