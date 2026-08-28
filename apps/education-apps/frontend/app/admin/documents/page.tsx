'use client';

import { useState, useEffect } from 'react';
import { Search, FileText, Printer, GraduationCap, MapPin, Phone, Mail } from 'lucide-react';
import api from '@/lib/api';
import { useSchoolProfile } from '@/hooks/useSchoolProfile';
import Button from '@/components/Button';
import Input from '@/components/Input';

interface Student {
    id: string;
    name: string;
    surname: string;
    phone?: string;
    email?: string;
    cin?: string;
    address?: string;
    birthDate?: string;
    birthPlace?: string;
    fatherName?: string;
    motherName?: string;
    schoolLevel?: string;
    currentSchool?: string;
    subjects?: any;
    inscriptions: any[];
    payments: any[];
}

export default function DocumentsPage() {
    const { profile } = useSchoolProfile();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [activeFilter, setActiveFilter] = useState<'SOUTIEN' | 'FORMATION'>('SOUTIEN');

    useEffect(() => {
        fetchSoutienStudents();
    }, []);

    const fetchSoutienStudents = async () => {
        try {
            setLoading(true);
            const response = await api.get('/documents/students');
            setStudents(response.data.data);
        } catch (error) {
            console.error('Failed to fetch students:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch = `${student.name} ${student.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.cin?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = student.inscriptions?.some(ins => ins.type === activeFilter);
        return matchesSearch && matchesType;
    });

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const checkSubject = (student: Student, subjectName: string) => {
        if (!student.subjects) return false;

        // Handle legacy array format if it exists
        if (Array.isArray(student.subjects)) {
            return student.subjects.includes(subjectName.toLowerCase());
        }

        // Handle object format
        const subjects = student.subjects;
        switch (subjectName) {
            case 'Maths': return subjects.maths;
            case 'Physique et Chimique': return subjects.physique;
            case 'S.V.T': return subjects.svt;
            case 'Français': return subjects.francais_soutien || subjects.francais_comm;
            case 'Anglais': return subjects.anglais_soutien || subjects.anglais_comm;
            case 'Allemande': return subjects.allemande_soutien || subjects.allemande_comm;
            case 'Espagnole': return subjects.espagnole_soutien || subjects.espagnole_comm;
            default: return false;
        }
    };

    const getPaymentForMonth = (monthName: string) => {
        if (!selectedStudent || !selectedStudent.payments) return null;

        const monthMap: { [key: string]: number } = {
            'Septembre': 8, 'Octobre': 9, 'Novembre': 10, 'Décembre': 11,
            'Janvier': 0, 'Février': 1, 'Mars': 2, 'Avril': 3, 'Mai': 4, 'Juin': 5
        };

        const targetMonth = monthMap[monthName];
        if (targetMonth === undefined) return null;

        return selectedStudent.payments.find(p => {
            const paymentDate = new Date(p.date);
            return paymentDate.getMonth() === targetMonth;
        });
    };

    const getStudentSubjects = (student: Student) => {
        if (!student.subjects) return '';
        const activeSubjects = [];
        const subjects = student.subjects;

        if (Array.isArray(subjects)) {
            return subjects.join(', ');
        }

        if (subjects.maths) activeSubjects.push('Maths');
        if (subjects.physique) activeSubjects.push('Physique');
        if (subjects.svt) activeSubjects.push('SVT');
        if (subjects.francais_soutien || subjects.francais_comm) activeSubjects.push('Français');
        if (subjects.anglais_soutien || subjects.anglais_comm) activeSubjects.push('Anglais');
        if (subjects.allemande_soutien || subjects.allemande_comm) activeSubjects.push('Allemand');
        if (subjects.espagnole_soutien || subjects.espagnole_comm) activeSubjects.push('Espagnol');

        return activeSubjects.join(', ');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Documents</h1>
                    <p className="text-gray-600 mt-1">Générer des fiches de renseignements pour les élèves</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                    <FileText className="text-blue-600" size={32} />
                </div>
            </div>

            {!selectedStudent ? (
                <>
                    {/* Filter Tabs */}
                    <div className="flex gap-4 bg-white p-2 rounded-2xl shadow-sm border border-gray-200">
                        <button
                            onClick={() => setActiveFilter('SOUTIEN')}
                            className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all ${activeFilter === 'SOUTIEN' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Soutien Scolaire
                        </button>
                        <button
                            onClick={() => setActiveFilter('FORMATION')}
                            className={`flex-1 py-3 px-6 rounded-xl font-bold transition-all ${activeFilter === 'FORMATION' ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Formation Pro
                        </button>
                    </div>

                    {/* Search */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <Input
                                type="text"
                                placeholder={`Rechercher un élève de ${activeFilter === 'SOUTIEN' ? 'Soutien' : 'Formation'}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12"
                            />
                        </div>
                    </div>

                    {/* Students List */}
                    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">
                            Élèves de {activeFilter === 'SOUTIEN' ? 'Soutien Scolaire' : 'Formation Professionnelle'}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredStudents.map((student) => (
                                <div
                                    key={student.id}
                                    className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => setSelectedStudent(student)}
                                >
                                    <h3 className="font-semibold text-gray-800">{student.name} {student.surname}</h3>
                                    {student.cin && <p className="text-sm text-gray-600">CIN: {student.cin}</p>}
                                    {student.schoolLevel && <p className="text-sm text-gray-600">Niveau: {student.schoolLevel}</p>}
                                </div>
                            ))}
                        </div>
                        {filteredStudents.length === 0 && (
                            <p className="text-center text-gray-500 py-8">Aucun élève trouvé</p>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* Document View */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 print:shadow-none print:border-0">
                        {/* Print Button - Hidden on print */}
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center print:hidden">
                            <Button
                                onClick={() => setSelectedStudent(null)}
                                variant="secondary"
                            >
                                ← Retour
                            </Button>
                        </div>

                        {/* Registration Form */}
                        <div className="p-8 print:p-0">
                            <div className="max-w-4xl mx-auto">
                                {/* Branded Header */}
                                <div className={`p-8 rounded-t-2xl mb-8 flex items-center justify-between border-b-4 ${activeFilter === 'SOUTIEN' ? 'bg-blue-600 border-blue-800' : 'bg-purple-600 border-purple-800'} text-white print:bg-white print:text-black print:border-black print:p-6 print:rounded-none`}>
                                    <div className="flex items-center gap-6">
                                        {profile?.logo ? (
                                            <div className="w-20 h-20 bg-white rounded-2xl p-2 shadow-lg print:shadow-none print:border print:border-gray-200">
                                                <img src={profile.logo} alt="Logo" className="w-full h-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm print:border print:border-gray-200">
                                                <GraduationCap size={40} className="text-white print:text-black" />
                                            </div>
                                        )}
                                        <div>
                                            <h1 className="text-3xl font-black uppercase tracking-tight">{profile?.schoolName || 'Smart School'}</h1>
                                            <div className="flex flex-col gap-1 mt-2 text-sm text-white/80 print:text-gray-600">
                                                {profile?.address && (
                                                    <div className="flex items-center gap-2">
                                                        <MapPin size={14} />
                                                        <span>{profile.address}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-4">
                                                    {profile?.phone && (
                                                        <div className="flex items-center gap-2">
                                                            <Phone size={14} />
                                                            <span>{profile.phone}</span>
                                                        </div>
                                                    )}
                                                    {profile?.email && (
                                                        <div className="flex items-center gap-2">
                                                            <Mail size={14} />
                                                            <span>{profile.email}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right hidden sm:block print:block">
                                        <p className="text-xs font-bold uppercase tracking-widest text-white/60 print:text-gray-500">Document Officiel</p>
                                        <p className="text-lg font-bold mt-1">N° {new Date().getFullYear()}/DOC</p>
                                    </div>
                                </div>

                                <div className="p-4 sm:p-0">
                                    {/* Traditional Header */}
                                    <div className="text-center mb-8">
                                        <p className="text-sm">A {profile?.city || '_______'} Le: {new Date().toLocaleDateString('fr-FR')}</p>
                                        <h1 className="text-2xl font-bold mt-4">ROYAUME DU MAROC</h1>
                                        <p className="text-lg font-semibold mt-2">MINISTERE D'EDUCATION NATIONALE</p>
                                        <h2 className="text-xl font-bold mt-8 mb-6 uppercase border-b-2 border-dashed border-gray-400 inline-block pb-1">
                                            {activeFilter === 'SOUTIEN' ? 'FICHE DE RENSEIGNEMENTS INDIVIDUEL' : 'ATTESTATION D\'INSCRIPTION'}
                                        </h2>
                                    </div>

                                    {/* Personal Information */}
                                    <div className="space-y-4 mb-8">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="font-semibold">NOM:</span>
                                                <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[200px]">
                                                    {selectedStudent.surname}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-semibold">PRÉNOM:</span>
                                                <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[200px]">
                                                    {selectedStudent.name}
                                                </span>
                                            </div>
                                        </div>

                                        {activeFilter === 'SOUTIEN' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="font-semibold">Date de naissance:</span>
                                                    <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[150px]">
                                                        {selectedStudent.birthDate ? new Date(selectedStudent.birthDate).toLocaleDateString('fr-FR') : ''}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold">Lieu de naissance:</span>
                                                    <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[150px]">
                                                        {selectedStudent.birthPlace || ''}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {activeFilter === 'SOUTIEN' && (
                                            <div>
                                                <span className="font-semibold">Fille ou fils de:</span>
                                                <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[250px]">
                                                    {selectedStudent.fatherName || ''}
                                                </span>
                                                <span className="ml-4 font-semibold">Et de:</span>
                                                <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[250px]">
                                                    {selectedStudent.motherName || ''}
                                                </span>
                                            </div>
                                        )}

                                        <div>
                                            <span className="font-semibold">Numéro du CIN:</span>
                                            <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[300px]">
                                                {selectedStudent.cin || ''}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="font-semibold">Adresse des parents:</span>
                                            <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[400px]">
                                                {selectedStudent.address || ''}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="font-semibold">Numéro de téléphone:</span>
                                            <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[300px]">
                                                {selectedStudent.phone || ''}
                                            </span>
                                        </div>

                                        {activeFilter === 'SOUTIEN' && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="font-semibold">Niveau scolaire:</span>
                                                    <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[150px]">
                                                        {selectedStudent.schoolLevel || ''}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold">Nom de l'École:</span>
                                                    <span className="ml-2 border-b border-dotted border-gray-400 inline-block min-w-[200px]">
                                                        {selectedStudent.currentSchool || ''}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {activeFilter === 'SOUTIEN' ? (
                                        <div className="mb-8">
                                            <h3 className="font-bold mb-4">Les Cours de Soutien</h3>
                                            <table className="w-full border-collapse border border-gray-400">
                                                <thead>
                                                    <tr>
                                                        <th className="border border-gray-400 p-2">Matières</th>
                                                        <th className="border border-gray-400 p-2">OUI</th>
                                                        <th className="border border-gray-400 p-2">NON</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="border border-gray-400 p-2 font-semibold" colSpan={3}>Les Matières scientifiques</td>
                                                    </tr>
                                                    {['Maths', 'Physique et Chimique', 'S.V.T'].map((subject) => (
                                                        <tr key={subject}>
                                                            <td className="border border-gray-400 p-2 pl-8">-{subject}</td>
                                                            <td className="border border-gray-400 p-2 text-center">
                                                                {checkSubject(selectedStudent, subject) ? '✓' : ''}
                                                            </td>
                                                            <td className="border border-gray-400 p-2 text-center">
                                                                {!checkSubject(selectedStudent, subject) ? '✓' : ''}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    <tr>
                                                        <td className="border border-gray-400 p-2 font-semibold" colSpan={3}>Les langues</td>
                                                    </tr>
                                                    {['Français', 'Anglais', 'Allemande', 'Espagnole'].map((subject) => (
                                                        <tr key={subject}>
                                                            <td className="border border-gray-400 p-2 pl-8">-{subject}</td>
                                                            <td className="border border-gray-400 p-2 text-center">
                                                                {checkSubject(selectedStudent, subject) ? '✓' : ''}
                                                            </td>
                                                            <td className="border border-gray-400 p-2 text-center">
                                                                {!checkSubject(selectedStudent, subject) ? '✓' : ''}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="mb-8">
                                            <h3 className="font-bold mb-4">Formation Professionnelle</h3>
                                            <div className="border border-gray-400 p-6 rounded-lg">
                                                <div className="space-y-4">
                                                    {selectedStudent.inscriptions
                                                        .filter(ins => ins.type === 'FORMATION')
                                                        .map((ins, idx) => (
                                                            <div key={idx} className="flex justify-between items-center border-b border-dotted border-gray-300 pb-2">
                                                                <span className="font-bold text-lg">{ins.category || 'Formation'}</span>
                                                                <span className="text-gray-600">Montant: {ins.amount} DH</span>
                                                            </div>
                                                        ))}
                                                </div>
                                                <div className="mt-8 pt-4 border-t border-gray-400">
                                                    <p className="text-sm font-semibold italic">Ce document atteste de l'inscription de l'étudiant à la formation professionnelle susmentionnée.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Inscription Info */}
                                    {selectedStudent.inscriptions.length > 0 && (
                                        <div className="mb-8">
                                            <table className="w-full border-collapse border border-gray-400">
                                                <thead>
                                                    <tr>
                                                        <th className="border border-gray-400 p-2">Date d'inscription</th>
                                                        <th className="border border-gray-400 p-2">Frais d'inscription (DH)</th>
                                                        <th className="border border-gray-400 p-2">Montant payé (DH)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td className="border border-gray-400 p-2 text-center">
                                                            {new Date(selectedStudent.inscriptions[0].date).toLocaleDateString('fr-FR')}
                                                        </td>
                                                        <td className="border border-gray-400 p-2 text-center">
                                                            {selectedStudent.inscriptions[0].amount}
                                                        </td>
                                                        <td className="border border-gray-400 p-2 text-center">
                                                            {selectedStudent.payments.reduce((sum, p) => sum + p.amount, 0)}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Suivi Page - Starts on new page when printing */}
                        <div className="p-8 print:p-12 print:break-before-page mt-8 border-t-4 border-dashed border-gray-300 print:border-0">
                            <div className="max-w-4xl mx-auto">
                                {/* Header */}
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold uppercase border-b-2 border-black inline-block pb-1">Fiche de Suivi</h2>
                                </div>

                                {/* Student Info Header for Suivi */}
                                <div className="mb-6 border border-black p-4 bg-gray-50 print:bg-transparent">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="font-bold">Nom et Prénom:</span> {selectedStudent.name} {selectedStudent.surname}
                                        </div>
                                        {activeFilter === 'SOUTIEN' && (
                                            <div>
                                                <span className="font-bold">Niveau:</span> {selectedStudent.schoolLevel}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2">
                                        <span className="font-bold">
                                            {activeFilter === 'SOUTIEN' ? 'Matières:' : 'Formations:'}
                                        </span>{' '}
                                        {activeFilter === 'SOUTIEN'
                                            ? getStudentSubjects(selectedStudent)
                                            : selectedStudent.inscriptions
                                                .filter(i => i.type === 'FORMATION')
                                                .map(i => i.category)
                                                .join(', ')
                                        }
                                    </div>
                                </div>

                                {/* Inscription Details Table */}
                                <div className="mb-8">
                                    <table className="w-full border-collapse border border-black">
                                        <thead>
                                            <tr className="bg-gray-100 print:bg-transparent">
                                                <th className="border border-black p-2 w-1/4">Date d'inscription</th>
                                                <th className="border border-black p-2 w-1/4">Frais d'inscription<br />(en Dhs)</th>
                                                <th className="border border-black p-2 w-1/4">Montant payé<br />(en Dhs)</th>
                                                <th className="border border-black p-2 w-1/4">Observation</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="border border-black p-4 text-center h-24 align-middle">
                                                    {selectedStudent.inscriptions.filter(i => i.type === activeFilter).length > 0
                                                        ? new Date(selectedStudent.inscriptions.filter(i => i.type === activeFilter)[0].date).toLocaleDateString('fr-FR')
                                                        : '....................'}
                                                </td>
                                                <td className="border border-black p-4 text-center h-24 align-middle">
                                                    {selectedStudent.inscriptions.filter(i => i.type === activeFilter).length > 0
                                                        ? selectedStudent.inscriptions.filter(i => i.type === activeFilter)[0].amount
                                                        : '....................'}
                                                </td>
                                                <td className="border border-black p-4 text-center h-24 align-middle">
                                                    {selectedStudent.payments.reduce((sum, p) => sum + p.amount, 0) || '....................'}
                                                </td>
                                                <td className="border border-black p-4 h-24 align-bottom">
                                                    {activeFilter === 'FORMATION' ? (
                                                        <div className="flex flex-col h-full justify-center text-center">
                                                            <span className="font-semibold text-lg">
                                                                {selectedStudent.inscriptions.find(i => i.type === 'FORMATION')?.category}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="border-b border-dotted border-black mb-2"></div>
                                                            <div className="border-b border-dotted border-black mb-2"></div>
                                                            <div className="border-b border-dotted border-black"></div>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Monthly Payment Schedule */}
                                <div>
                                    <table className="w-full border-collapse border border-black text-sm">
                                        <thead>
                                            <tr className="bg-gray-100 print:bg-transparent">
                                                <th className="border border-black p-2 w-24">Mois</th>
                                                <th className="border border-black p-2 w-24">Date</th>
                                                <th className="border border-black p-2">Payé par<br />(Espèces / C.B-N²)</th>
                                                <th className="border border-black p-2 w-32">Signature</th>
                                                <th className="border border-black p-2 w-1/3">Observation</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'].map((month) => {
                                                const payment = getPaymentForMonth(month);
                                                return (
                                                    <tr key={month}>
                                                        <td className="border border-black p-2 font-semibold">{month}</td>
                                                        <td className="border border-black p-2 text-center">
                                                            {payment ? (
                                                                <span className="font-medium">{new Date(payment.date).toLocaleDateString('fr-FR')}</span>
                                                            ) : (
                                                                <div className="border-b border-dotted border-black h-6 mt-2"></div>
                                                            )}
                                                        </td>
                                                        <td className="border border-black p-2 text-center">
                                                            {payment ? (
                                                                <span className="font-medium">{payment.method || 'Espèces'}</span>
                                                            ) : (
                                                                <div className="border-b border-dotted border-black h-6 mt-2"></div>
                                                            )}
                                                        </td>
                                                        <td className="border border-black p-2 text-center">
                                                            {payment ? (
                                                                <span className="font-bold text-green-600 font-script text-lg">Signé</span>
                                                            ) : (
                                                                <div className="border-b border-dotted border-black h-6 mt-2"></div>
                                                            )}
                                                        </td>
                                                        <td className="border border-black p-2">
                                                            {payment && payment.note ? (
                                                                <span className="text-xs">{payment.note}</span>
                                                            ) : (
                                                                <>
                                                                    <div className="border-b border-dotted border-black h-6 mt-2"></div>
                                                                    <div className="border-b border-dotted border-black h-6 mt-2"></div>
                                                                </>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-8 text-center text-green-600 font-bold text-lg font-serif">
                                    Signed by {profile?.schoolName || 'Smart School'}{profile?.address ? ` — ${profile.address}` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
