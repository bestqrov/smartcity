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
import { transactionsApi } from '@/lib/services/transactions';

export default function SecretaryTransactionsPage() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalIncome: 0, totalExpense: 0, balance: 0 });
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');

    useEffect(() => {
        loadTransactions();
        loadStats();
    }, []);

    const loadTransactions = async () => {
        setLoading(true);
        const result = await transactionsApi.getAll();
        if (result.success) setTransactions(result.data || []);
        setLoading(false);
    };

    const loadStats = async () => {
        const result = await transactionsApi.getStats();
        if (result.success) setStats(result.data);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'ALL' || t.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Caisse & Transactions</h1>
                    <p className="text-gray-500">Suivi des flux financiers de l'établissement</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><TrendingUp className="text-green-600" /></div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalIncome)}</div>
                    <div className="text-xs text-green-600 font-bold uppercase tracking-wider">Entrées</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="bg-red-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><TrendingDown className="text-red-600" /></div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalExpense)}</div>
                    <div className="text-xs text-red-600 font-bold uppercase tracking-wider">Sorties</div>
                </div>
                <div className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
                    <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4"><Wallet /></div>
                    <div className="text-2xl font-bold">{formatCurrency(stats.balance)}</div>
                    <div className="text-xs text-blue-100 font-bold uppercase tracking-wider">Solde Actuel</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-2">
                        {['ALL', 'INCOME', 'EXPENSE'].map(type => (
                            <button key={type} onClick={() => setFilterType(type)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === type ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                                {type === 'ALL' ? 'Tout' : type === 'INCOME' ? 'Revenus' : 'Dépenses'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Catégorie</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right">Montant</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-10 text-center text-slate-400">Chargement...</td></tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr><td colSpan={5} className="p-10 text-center text-slate-400">Aucune transaction</td></tr>
                            ) : filteredTransactions.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${t.type === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {t.type === 'INCOME' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                                            {t.type === 'INCOME' ? 'REVENU' : 'DÉPENSE'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-gray-700 text-sm">{t.description}</td>
                                    <td className="px-6 py-4 text-xs text-gray-500">{t.category}</td>
                                    <td className="px-6 py-4 text-xs text-gray-400">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className={`px-6 py-4 text-right font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
