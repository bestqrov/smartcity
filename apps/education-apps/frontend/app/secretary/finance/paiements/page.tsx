'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    DollarSign,
    Calendar,
    Check,
    X,
    FileText
} from 'lucide-react';
import { getTeachers } from '@/lib/services/teachers';
import { getSecretaries } from '@/lib/services/users';

export default function SecretaryPaiementsPage() {
    const [personnel, setPersonnel] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [teachers, secretaries] = await Promise.all([
                getTeachers(),
                getSecretaries()
            ]);

            setPersonnel([
                ...teachers.map(t => ({ ...t, type: 'TEACHER' })),
                ...secretaries.map(s => ({ ...s, type: 'SECRETARY' }))
            ]);

            const storedPayments = localStorage.getItem('salary-payments');
            if (storedPayments) setPayments(JSON.parse(storedPayments));
        } catch (error) {
            console.error('Failed to load payroll data:', error);
        }
    };

    const monthlyPayments = payments.filter(p => p.month === selectedMonth);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Suivi des Salaires</h1>
                <p className="text-gray-500">Consultation des paiements du personnel pour le mois en cours</p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Calendar className="text-blue-600" />
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                </div>
                <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase">Masse Salariale du Mois</div>
                    <div className="text-2xl font-bold text-gray-900">
                        {monthlyPayments.reduce((sum, p) => sum + p.calculatedAmount, 0).toFixed(2)} MAD
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Nom</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Montant</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {monthlyPayments.length === 0 ? (
                            <tr><td colSpan={4} className="p-10 text-center text-slate-400">Aucun paiement enregistré pour ce mois</td></tr>
                        ) : monthlyPayments.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                                <td className="px-6 py-4 font-bold text-gray-700">{p.personnelName}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.personnelType === 'TEACHER' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                        {p.personnelType}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${p.status === 'PAID' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {p.status === 'PAID' ? <Check size={12} /> : <X size={12} />}
                                        {p.status === 'PAID' ? 'PAYÉ' : 'EN ATTENTE'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-gray-900">{p.calculatedAmount.toFixed(2)} MAD</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
