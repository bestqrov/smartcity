'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    DollarSign,
    TrendingUp,
    Calendar,
    Plus,
    Edit,
    Trash2,
    Check,
    X,
    FileText,
    Percent
} from 'lucide-react';
import { updateLocalStorage } from '@/lib/utils';
import { getTeachers, createTeacher, updateTeacher, deleteTeacher } from '@/lib/services/teachers';
import { getSecretaries } from '@/lib/services/users';
import { createSalaryPayment } from '@/lib/services/payments';

interface Personnel {
    id: string;
    name: string;
    type: 'TEACHER' | 'SECRETARY';
    salaryType: 'PERCENTAGE' | 'FIXED_MONTHLY' | 'FORFAIT';
    salaryAmount?: number;
    salaryPercentage?: number;
    groupIds?: string[];
}

interface SalaryPayment {
    id: string;
    personnelId: string;
    personnelName: string;
    personnelType: 'TEACHER' | 'SECRETARY';
    salaryType: string;
    month: string;
    calculatedAmount: number;
    paidAmount: number;
    paymentDate?: string;
    status: 'PENDING' | 'PAID' | 'PARTIAL';
    notes?: string;
}

const getSalaryTypeLabel = (type: string) => {
    switch (type) {
        case 'PERCENTAGE': return 'Salaire avec %';
        case 'FIXED_MONTHLY': return 'Mensuel Fixe';
        case 'FORFAIT': return 'Forfait';
        default: return type;
    }
};


export default function PaiementsPage() {
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [payments, setPayments] = useState<SalaryPayment[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [showPersonnelModal, setShowPersonnelModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        type: 'TEACHER' as 'TEACHER' | 'SECRETARY',
        salaryType: 'FIXED_MONTHLY' as 'PERCENTAGE' | 'FIXED_MONTHLY' | 'FORFAIT',
        salaryAmount: '',
        salaryPercentage: '',
        groupIds: [] as string[]
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Load personnel from API
            const teachersData = await getTeachers();
            const paddedTeachers = teachersData.map(t => ({
                id: t.id,
                name: t.name,
                type: 'TEACHER' as const,
                salaryType: t.paymentType === 'PERCENTAGE' ? 'PERCENTAGE' : t.paymentType === 'HOURLY' ? 'FIXED_MONTHLY' : 'FORFAIT', // Mapping types
                salaryAmount: t.hourlyRate, // Using hourlyRate as base amount
                salaryPercentage: t.commission,
                groupIds: [], // Groups not yet linked in simple view
            }));

            const secretariesData = await getSecretaries();
            const paddedSecretaries = secretariesData.map(s => ({
                id: s.id,
                name: s.name,
                type: 'SECRETARY' as const,
                salaryType: 'FORFAIT' as const,
                salaryAmount: 2000, // Default or fetch specific metadata
                salaryPercentage: 0,
            }));

            // Combine
            setPersonnel([...paddedTeachers, ...paddedSecretaries] as Personnel[]);

        } catch (error) {
            console.error('Failed to load personnel:', error);
        }

        // Load payments (still local for now until we add GET /payments/salary endpoint or filter transactions)
        // Ideally we should have an API for getting salary history. 
        // For now, keeping payments local-ish but creating them pushes to backend.
        const storedPayments = localStorage.getItem('salary-payments');
        if (storedPayments) {
            setPayments(JSON.parse(storedPayments));
        }

        // Load groups
        const storedGroups = localStorage.getItem('groups');
        if (storedGroups) {
            setGroups(JSON.parse(storedGroups));
        }
    };

    const savePersonnel = (data: Personnel[]) => {
        // This is now handled via API calls in handlers
        setPersonnel(data);
    };

    const savePayments = (data: SalaryPayment[]) => {
        setPayments(data);
        updateLocalStorage('salary-payments', data);
    };

    const handleSubmitPersonnel = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (formData.type === 'TEACHER') {
                if (editingPersonnel) {
                    await updateTeacher(editingPersonnel.id, {
                        name: formData.name,
                        paymentType: formData.salaryType === 'PERCENTAGE' ? 'PERCENTAGE' : 'HOURLY',
                        hourlyRate: formData.salaryAmount ? parseFloat(formData.salaryAmount) : 0,
                        commission: formData.salaryPercentage ? parseFloat(formData.salaryPercentage) : 0,
                    });
                } else {
                    await createTeacher({
                        name: formData.name,
                        paymentType: formData.salaryType === 'PERCENTAGE' ? 'PERCENTAGE' : 'HOURLY',
                        hourlyRate: formData.salaryAmount ? parseFloat(formData.salaryAmount) : 0,
                        commission: formData.salaryPercentage ? parseFloat(formData.salaryPercentage) : 0,
                    });
                }
                loadData(); // Reload to get fresh data
            } else {
                alert("La création de secrétaires doit se faire via la page Utilisateurs.");
            }
            resetForm();
        } catch (error) {
            console.error('Error saving personnel:', error);
            alert('Erreur lors de la sauvegarde');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: 'TEACHER',
            salaryType: 'FIXED_MONTHLY',
            salaryAmount: '',
            salaryPercentage: '',
            groupIds: []
        });
        setEditingPersonnel(null);
        setShowPersonnelModal(false);
    };

    const handleEdit = (person: Personnel) => {
        setEditingPersonnel(person);
        setFormData({
            name: person.name,
            type: person.type,
            salaryType: person.salaryType,
            salaryAmount: person.salaryAmount?.toString() || '',
            salaryPercentage: person.salaryPercentage?.toString() || '',
            groupIds: person.groupIds || []
        });
        setShowPersonnelModal(true);
    };

    const handleDelete = (id: string) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce personnel ?')) {
            savePersonnel(personnel.filter(p => p.id !== id));
        }
    };

    const calculateSalary = (person: Personnel, month: string): number => {
        if (person.salaryType === 'FIXED_MONTHLY' || person.salaryType === 'FORFAIT') {
            return person.salaryAmount || 0;
        }

        if (person.salaryType === 'PERCENTAGE' && person.groupIds && person.salaryPercentage) {
            // Calculate from receipts for this person's groups
            const receipts = JSON.parse(localStorage.getItem('receipts') || '[]');
            const [year, monthNum] = month.split('-');

            const totalRevenue = receipts
                .filter((r: any) => {
                    const receiptDate = new Date(r.createdAt);
                    return receiptDate.getFullYear() === parseInt(year) &&
                        receiptDate.getMonth() + 1 === parseInt(monthNum);
                })
                .reduce((sum: number, r: any) => sum + r.totalAmount, 0);

            return (totalRevenue * person.salaryPercentage) / 100;
        }

        return 0;
    };

    const generateMonthlySalaries = () => {
        const newPayments: SalaryPayment[] = [];

        personnel.forEach(person => {
            const existingPayment = payments.find(
                p => p.personnelId === person.id && p.month === selectedMonth
            );

            if (!existingPayment) {
                const calculatedAmount = calculateSalary(person, selectedMonth);
                newPayments.push({
                    id: Date.now().toString() + person.id,
                    personnelId: person.id,
                    personnelName: person.name,
                    personnelType: person.type,
                    salaryType: person.salaryType,
                    month: selectedMonth,
                    calculatedAmount,
                    paidAmount: 0,
                    status: 'PENDING'
                });
            }
        });

        if (newPayments.length > 0) {
            savePayments([...payments, ...newPayments]);
        }
    };

    const markAsPaid = (paymentId: string) => {
        savePayments(payments.map(p =>
            p.id === paymentId
                ? { ...p, status: 'PAID' as const, paidAmount: p.calculatedAmount, paymentDate: new Date().toISOString() }
                : p
        ));
    };

    const [editingPayment, setEditingPayment] = useState<SalaryPayment | null>(null);

    const handleEditPayment = (payment: SalaryPayment) => {
        setEditingPayment(payment);
        setShowPaymentModal(true);
    };

    const handleDeletePayment = (id: string) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
            savePayments(payments.filter(p => p.id !== id));
        }
    };

    const teachers = personnel.filter(p => p.type === 'TEACHER');
    const secretaries = personnel.filter(p => p.type === 'SECRETARY');
    const monthlyPayments = payments.filter(p => p.month === selectedMonth);



    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Gestion des Salaires</h1>
                    <p className="text-gray-600 mt-1">Gérer les salaires du personnel</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all"
                    >
                        <DollarSign size={20} />
                        Effectuer un salaire
                    </button>
                    <button
                        onClick={() => setShowPersonnelModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all"
                    >
                        <Plus size={20} />
                        Ajouter Personnel
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-blue-100 p-3 rounded-xl">
                            <Users className="text-blue-600" size={24} />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{teachers.length}</h3>
                    <p className="text-gray-500 text-sm mt-1">Professeurs</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-purple-100 p-3 rounded-xl">
                            <Users className="text-purple-600" size={24} />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{secretaries.length}</h3>
                    <p className="text-gray-500 text-sm mt-1">Secrétaires</p>
                </div>

                <div className="bg-gradient-to-br from-green-600 to-emerald-600 p-6 rounded-2xl shadow-lg text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                            <DollarSign className="text-white" size={24} />
                        </div>
                    </div>
                    <h3 className="text-3xl font-bold">
                        {monthlyPayments.reduce((sum, p) => sum + p.calculatedAmount, 0).toFixed(2)} MAD
                    </h3>
                    <p className="text-green-100 text-sm mt-1">Total ce mois</p>
                </div>
            </div>

            {/* Monthly Salary Calculation */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Calcul Mensuel</h2>
                    <div className="flex items-center gap-4">
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <button
                            onClick={generateMonthlySalaries}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-all"
                        >
                            <Calendar size={18} />
                            Générer Salaires
                        </button>
                    </div>
                </div>

                {monthlyPayments.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Nom</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Type</th>
                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Salaire</th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Montant</th>
                                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Statut</th>
                                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {monthlyPayments.map(payment => (
                                    <tr key={payment.id} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium text-gray-800">{payment.personnelName}</td>
                                        <td className="py-3 px-4 text-gray-600">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${payment.personnelType === 'TEACHER'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-purple-100 text-purple-700'
                                                }`}>
                                                {payment.personnelType === 'TEACHER' ? 'Professeur' : 'Secrétaire'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-600 text-sm">
                                            {getSalaryTypeLabel(payment.salaryType)}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-gray-800">
                                            {payment.calculatedAmount.toFixed(2)} MAD
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${payment.status === 'PAID'
                                                ? 'bg-green-100 text-green-700'
                                                : payment.status === 'PARTIAL'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {payment.status === 'PAID' ? 'Payé' : payment.status === 'PARTIAL' ? 'Partiel' : 'En attente'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {payment.status !== 'PAID' && (
                                                    <button
                                                        onClick={() => markAsPaid(payment.id)}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                        title="Marquer comme payé"
                                                    >
                                                        <Check size={18} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEditPayment(payment)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Modifier"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePayment(payment.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        Aucun salaire calculé pour ce mois. Cliquez sur "Générer Salaires" pour commencer.
                    </div>
                )}
            </div>

            {/* Personnel Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Teachers */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Professeurs</h2>
                    <div className="space-y-3">
                        {teachers.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Aucun professeur</p>
                        ) : (
                            teachers.map(teacher => (
                                <div key={teacher.id} className="p-4 border border-gray-100 rounded-xl hover:border-blue-200 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800">{teacher.name}</h3>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {getSalaryTypeLabel(teacher.salaryType)}
                                                {teacher.salaryType === 'PERCENTAGE' && ` (${teacher.salaryPercentage}%)`}
                                                {(teacher.salaryType === 'FIXED_MONTHLY' || teacher.salaryType === 'FORFAIT') &&
                                                    ` (${teacher.salaryAmount} MAD)`}
                                            </p>
                                            {teacher.groupIds && teacher.groupIds.length > 0 && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {teacher.groupIds.length} groupe(s)
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(teacher)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(teacher.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Secretaries */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Secrétaires</h2>
                    <div className="space-y-3">
                        {secretaries.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">Aucun secrétaire</p>
                        ) : (
                            secretaries.map(secretary => (
                                <div key={secretary.id} className="p-4 border border-gray-100 rounded-xl hover:border-purple-200 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800">{secretary.name}</h3>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Forfait ({secretary.salaryAmount} MAD/mois)
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(secretary)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(secretary.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Personnel Modal */}
            {showPersonnelModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingPersonnel ? 'Modifier Personnel' : 'Ajouter Personnel'}
                            </h2>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmitPersonnel} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Nom</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'TEACHER', salaryType: 'FIXED_MONTHLY' })}
                                        className={`py-3 rounded-xl font-bold border-2 transition-all ${formData.type === 'TEACHER'
                                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                    >
                                        Professeur
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, type: 'SECRETARY', salaryType: 'FORFAIT' })}
                                        className={`py-3 rounded-xl font-bold border-2 transition-all ${formData.type === 'SECRETARY'
                                            ? 'border-purple-500 bg-purple-50 text-purple-600'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                    >
                                        Secrétaire
                                    </button>
                                </div>
                            </div>

                            {formData.type === 'TEACHER' && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Type de Salaire</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, salaryType: 'PERCENTAGE' })}
                                            className={`py-2 px-3 rounded-lg font-medium border-2 transition-all text-sm ${formData.salaryType === 'PERCENTAGE'
                                                ? 'border-green-500 bg-green-50 text-green-600'
                                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                }`}
                                        >
                                            Avec %
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, salaryType: 'FIXED_MONTHLY' })}
                                            className={`py-2 px-3 rounded-lg font-medium border-2 transition-all text-sm ${formData.salaryType === 'FIXED_MONTHLY'
                                                ? 'border-blue-500 bg-blue-50 text-blue-600'
                                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                }`}
                                        >
                                            Mensuel Fixe
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, salaryType: 'FORFAIT' })}
                                            className={`py-2 px-3 rounded-lg font-medium border-2 transition-all text-sm ${formData.salaryType === 'FORFAIT'
                                                ? 'border-orange-500 bg-orange-50 text-orange-600'
                                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                }`}
                                        >
                                            Forfait
                                        </button>
                                    </div>
                                </div>
                            )}

                            {formData.salaryType === 'PERCENTAGE' ? (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Pourcentage (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={formData.salaryPercentage}
                                        onChange={(e) => setFormData({ ...formData, salaryPercentage: e.target.value })}
                                        required
                                        placeholder="Ex: 30"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Montant (MAD)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.salaryAmount}
                                        onChange={(e) => setFormData({ ...formData, salaryAmount: e.target.value })}
                                        required
                                        placeholder="Ex: 5000"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            )}

                            {formData.type === 'TEACHER' && groups.length > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Groupes (optionnel)</label>
                                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                                        {groups.map(group => (
                                            <label key={group.id} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.groupIds.includes(group.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, groupIds: [...formData.groupIds, group.id] });
                                                        } else {
                                                            setFormData({ ...formData, groupIds: formData.groupIds.filter(id => id !== group.id) });
                                                        }
                                                    }}
                                                    className="rounded"
                                                />
                                                <span className="text-sm text-gray-700">{group.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg transition-all"
                                >
                                    {editingPersonnel ? 'Mettre à jour' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manual Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingPayment ? 'Modifier Paiement' : 'Effectuer un Paiement'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPaymentModal(false);
                                    setEditingPayment(null);
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const form = e.target as HTMLFormElement;
                            const personnelId = (form.elements.namedItem('personnel') as HTMLSelectElement).value;
                            const amount = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value);
                            const date = (form.elements.namedItem('date') as HTMLInputElement).value;

                            const person = personnel.find(p => p.id === personnelId);
                            if (person) {
                                try {
                                    // Call Backend API
                                    await createSalaryPayment({
                                        personnelId: person.id,
                                        personnelType: person.type,
                                        amount: amount,
                                        month: date.slice(0, 7),
                                        date: new Date(date),
                                    });

                                    // Update State Locally for Display
                                    if (editingPayment) {
                                        // Update existing payment logic if we support editing via API later
                                    } else {
                                        const newPayment: SalaryPayment = {
                                            id: Date.now().toString(),
                                            personnelId: person.id,
                                            personnelName: person.name,
                                            personnelType: person.type,
                                            salaryType: person.salaryType,
                                            month: date.slice(0, 7),
                                            calculatedAmount: amount,
                                            paidAmount: amount,
                                            paymentDate: new Date().toISOString(),
                                            status: 'PAID'
                                        };
                                        savePayments([...payments, newPayment]);
                                    }
                                    setShowPaymentModal(false);
                                    setEditingPayment(null);
                                    alert('Paiement enregistré avec succès et ajouté aux dépenses.');
                                } catch (error) {
                                    console.error('Error paying salary:', error);
                                    alert('Erreur lors du paiement du salaire');
                                }
                            }
                        }} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Personnel</label>
                                <select
                                    name="personnel"
                                    required
                                    defaultValue={editingPayment?.personnelId || ''}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                >
                                    <option value="">Sélectionner un personnel</option>
                                    {personnel.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.type === 'TEACHER' ? 'Prof' : 'Secrétaire'})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Montant (MAD)</label>
                                <input
                                    type="number"
                                    name="amount"
                                    step="0.01"
                                    required
                                    defaultValue={editingPayment?.calculatedAmount || ''}
                                    placeholder="0.00"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    required
                                    defaultValue={editingPayment?.paymentDate ? editingPayment.paymentDate.split('T')[0] : new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className="w-full py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-lg transition-all"
                                >
                                    {editingPayment ? 'Mettre à jour' : 'Confirmer le Paiement'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
