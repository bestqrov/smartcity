'use client';

import { useState, useEffect } from 'react';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Plus,
    Trash2,
    Search,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet,
    X
} from 'lucide-react';
import { triggerDashboardRefresh } from '@/lib/utils/dashboardRefresh';
import { transactionsApi } from '@/lib/services/transactions';

import { appLocale, useI18n } from '@/lib/i18n/I18nProvider';
interface Transaction {
    id: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    category: string;
    description: string;
    date: string;
}

interface TransactionStats {
    totalIncome: number;
    totalExpense: number;
    balance: number;
}

interface Personnel {
    id: string;
    name: string;
    description: string;
    role: string;
}

export default function TransactionsPage() {
    const { tr } = useI18n();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<TransactionStats>({ totalIncome: 0, totalExpense: 0, balance: 0 });
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

    // Form state
    const [transactionType, setTransactionType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Personnel state
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [selectedPersonnel, setSelectedPersonnel] = useState('');
    const [isSalary, setIsSalary] = useState(false);

    useEffect(() => {
        loadTransactions();
        loadStats();
        loadPersonnel();
    }, []);

    const loadPersonnel = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const headers = { 'Authorization': `Bearer ${token}` };
            const API_PORT = '3000';

            // Fetch Teachers
            const teachersRes = await fetch(`http://localhost:${API_PORT}/teachers`, { headers });
            const teachersData = await teachersRes.json();

            // Fetch Users (Admins/Secretaries)
            const usersRes = await fetch(`http://localhost:${API_PORT}/users`, { headers });
            const usersData = await usersRes.json();

            const allPersonnel: Personnel[] = [];

            if (teachersData.success && teachersData.data) {
                teachersData.data.forEach((t: any) => {
                    allPersonnel.push({
                        id: t.id,
                        name: `${t.name} ${t.surname || ''}`.trim(),
                        description: `Enseignant (${t.paymentType})`,
                        role: 'TEACHER'
                    });
                });
            }

            if (usersData.success && usersData.data) {
                usersData.data.forEach((u: any) => {
                    allPersonnel.push({
                        id: u.id,
                        name: u.name,
                        description: u.role,
                        role: u.role
                    });
                });
            }

            setPersonnel(allPersonnel);
        } catch (error) {
            console.error('Failed to load personnel:', error);
        }
    };

    const loadTransactions = async () => {
        try {
            setLoading(true);
            const result = await transactionsApi.getAll();
            if (result.success) {
                setTransactions(result.data || []);
            } else {
                console.error('Failed to load transactions:', result);
            }
        } catch (error) {
            console.error('Failed to load transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const result = await transactionsApi.getStats();
            if (result.success) {
                setStats(result.data);
            } else {
                console.error('Failed to load stats:', result);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            console.log('Creating transaction...');

            const result = await transactionsApi.create({
                type: transactionType,
                amount: parseFloat(amount),
                category: category,
                description: description,
                date: date
            });

            console.log('API Response:', result);

            if (result.success) {
                // Reload transactions and stats
                await loadTransactions();
                await loadStats();

                // Trigger dashboard refresh
                triggerDashboardRefresh();

                // Reset form
                setAmount('');
                setCategory('');
                setDescription('');
                setDate(new Date().toISOString().split('T')[0]);
                setShowModal(false);
            } else {
                console.error('Transaction creation failed:', result);
                alert(tr("Erreur: {v0}", { v0: result.error || result.message || 'Erreur inconnue' }));
            }
        } catch (error: any) {
            console.error('Error creating transaction:', error);
            alert(tr("Erreur: {v0}", { v0: error.message || 'Impossible de créer la transaction' }));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(tr("Êtes-vous sûr de vouloir supprimer cette transaction ?"))) return;

        try {
            const result = await transactionsApi.delete(id);

            if (result.success) {
                // Reload transactions and stats
                await loadTransactions();
                await loadStats();

                // Trigger dashboard refresh
                triggerDashboardRefresh();
            } else {
                alert(tr("Erreur: {v0}", { v0: result.error || result.message || 'Erreur lors de la suppression' }));
            }
        } catch (error: any) {
            console.error('Error deleting transaction:', error);
            alert(tr("Erreur: {v0}", { v0: error.message || 'Impossible de supprimer la transaction' }));
        }
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'ALL' || t.type === filterType;
        return matchesSearch && matchesType;
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat(appLocale(), { style: 'currency', currency: 'MAD' }).format(amount);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{tr("Transactions")}</h1>
                    <p className="text-gray-600 mt-1">{tr("Gérer les revenus et les dépenses")}</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105"
                >
                    <Plus size={20} />{tr("Nouvelle Transaction")}</button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-green-100 p-3 rounded-xl">
                            <TrendingUp className="text-green-600" size={24} />
                        </div>
                        <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">{tr("Revenus")}</span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{formatCurrency(stats.totalIncome)}</h3>
                    <p className="text-gray-500 text-sm mt-1">{tr("Total des entrées")}</p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-red-100 p-3 rounded-xl">
                            <TrendingDown className="text-red-600" size={24} />
                        </div>
                        <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full">{tr("Dépenses")}</span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800">{formatCurrency(stats.totalExpense)}</h3>
                    <p className="text-gray-500 text-sm mt-1">{tr("Total des sorties")}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-6 rounded-2xl shadow-lg text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                            <Wallet className="text-white" size={24} />
                        </div>
                        <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">{tr("Solde")}</span>
                    </div>
                    <h3 className="text-3xl font-bold">{formatCurrency(stats.balance)}</h3>
                    <p className="text-blue-100 text-sm mt-1">{tr("Balance actuelle")}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex-1 relative">
                    <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder={tr("Rechercher une transaction...")}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full ps-10 pe-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    {(['ALL', 'INCOME', 'EXPENSE'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filterType === type
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {type === 'ALL' ? tr("Tout") : type === 'INCOME' ? tr("Revenus") : tr("Dépenses")}
                        </button>
                    ))}
                </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="text-start py-4 px-6 text-sm font-semibold text-gray-600">{tr("Type")}</th>
                                <th className="text-start py-4 px-6 text-sm font-semibold text-gray-600">{tr("Description")}</th>
                                <th className="text-start py-4 px-6 text-sm font-semibold text-gray-600">{tr("Catégorie")}</th>
                                <th className="text-start py-4 px-6 text-sm font-semibold text-gray-600">{tr("Date")}</th>
                                <th className="text-end py-4 px-6 text-sm font-semibold text-gray-600">{tr("Montant")}</th>
                                <th className="text-end py-4 px-6 text-sm font-semibold text-gray-600">{tr("Actions")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500">{tr("Aucune transaction trouvée")}</td>
                                </tr>
                            ) : (
                                filteredTransactions.map((transaction) => (
                                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${transaction.type === 'INCOME'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}>
                                                {transaction.type === 'INCOME' ? (
                                                    <ArrowDownLeft size={14} />
                                                ) : (
                                                    <ArrowUpRight size={14} />
                                                )}
                                                {transaction.type === 'INCOME' ? tr("Revenu") : tr("Dépense")}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 font-medium text-gray-800">
                                            {transaction.description || '-'}
                                        </td>
                                        <td className="py-4 px-6 text-gray-600">
                                            {transaction.category}
                                        </td>
                                        <td className="py-4 px-6 text-gray-600">
                                            {new Date(transaction.date).toLocaleDateString(appLocale())}
                                        </td>
                                        <td className={`py-4 px-6 text-end font-bold ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {transaction.type === 'INCOME' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                        </td>
                                        <td className="py-4 px-6 text-end">
                                            <button
                                                onClick={() => handleDelete(transaction.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800">{tr("Nouvelle Transaction")}</h2>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">{tr("Type")}</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setTransactionType('INCOME')}
                                        className={`py-3 rounded-xl font-bold border-2 transition-all ${transactionType === 'INCOME'
                                            ? 'border-green-500 bg-green-50 text-green-600'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                    >{tr("Revenu")}</button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTransactionType('EXPENSE');
                                            // Reset salary toggle when switching types
                                            if (transactionType !== 'EXPENSE') setIsSalary(false);
                                        }}
                                        className={`py-3 rounded-xl font-bold border-2 transition-all ${transactionType === 'EXPENSE'
                                            ? 'border-red-500 bg-red-50 text-red-600'
                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                            }`}
                                    >{tr("Dépense")}</button>
                                </div>
                            </div>

                            {/* Salary Selection */}
                            {transactionType === 'EXPENSE' && (
                                <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isSalary}
                                            onChange={(e) => {
                                                setIsSalary(e.target.checked);
                                                if (e.target.checked) {
                                                    setCategory('Salaire');
                                                } else {
                                                    setCategory('');
                                                    setSelectedPersonnel('');
                                                    setDescription('');
                                                }
                                            }}
                                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                        />
                                        <span className="font-semibold text-gray-700">{tr("Est-ce un salaire ?")}</span>
                                    </label>

                                    {isSalary && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-600 mb-2">{tr("Bénéficiaire (Employé)")}</label>
                                            <select
                                                value={selectedPersonnel}
                                                onChange={(e) => {
                                                    const id = e.target.value;
                                                    setSelectedPersonnel(id);
                                                    const person = personnel.find(p => p.id === id);
                                                    if (person) {
                                                        setDescription(`Salaire - ${person.name} (${person.description})`);
                                                    }
                                                }}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                                            >
                                                <option value="">{tr("Sélectionner un employé...")}</option>
                                                {personnel.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} - {p.description}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">{tr("Montant (MAD)")}</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                    placeholder="0.00"
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">{tr("Catégorie")}</label>
                                <input
                                    type="text"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    required
                                    placeholder={tr("Ex: Loyer, Facture, etc.")}
                                    readOnly={isSalary} // Lock category if salary
                                    className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none ${isSalary ? 'bg-gray-100 text-gray-500' : ''}`}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">{tr("Description")}</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={tr("Détails supplémentaires...")}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">{tr("Date")}</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-[1.02] ${transactionType === 'INCOME'
                                        ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30'
                                        : 'bg-red-600 hover:bg-red-700 shadow-red-500/30'
                                        }`}
                                >{tr("Enregistrer")}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
