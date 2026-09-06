'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Button from '@/components/Button';
import {
    PlusCircle,
    Edit,
    Trash2,
    Eye,
    Printer,
    Search,
    User,
    X,
    ArrowLeft,
    GraduationCap,
    CheckCircle,
    Calendar,
    Phone,
    CreditCard,
    FileText
} from 'lucide-react';

interface Receipt {
    id: number;
    date: string;
    time?: string;
    receiptNumber: string;
    issuedTo: string;
    phoneNumber?: string;
    items: { description: string; amount: number }[];
    totalAmount: number;
    amountPaid: number;
    paymentMethod: 'Cash' | 'Check';
    receiptType: 'Soutien' | 'Formation' | 'Other';
    checkNumber?: string;
    notes?: string;
}

export default function RecuPage() {
    const router = useRouter();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [studentSearchSubTerm, setStudentSearchSubTerm] = useState('');
    const [showStudentDropdown, setShowStudentDropdown] = useState(false);
    const [filterDate, setFilterDate] = useState('');
    const [filterMonth, setFilterMonth] = useState('');

    const initialFormState = {
        date: new Date().toISOString().substring(0, 10),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        receiptNumber: '', // Will be calculated on mount or change
        issuedTo: '',
        phoneNumber: '',
        items: [{ description: '', amount: 0 }],
        amountPaid: '',
        paymentMethod: 'Cash' as 'Cash' | 'Check',
        receiptType: 'Soutien' as 'Soutien' | 'Formation' | 'Other',
        checkNumber: '',
        notes: '',
    };

    const [formData, setFormData] = useState(initialFormState);
    const [schoolProfile, setSchoolProfile] = useState({
        schoolName: 'Smart School',
        address: '',
        phone: '',
        logo: null as string | null
    });
    const totalAmount = useMemo(() => formData.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [formData.items]);

    useEffect(() => {
        loadReceipts();
        loadSchoolProfile();
        loadStudents();
    }, []);

    const loadStudents = async () => {
        setIsLoadingStudents(true);
        try {
            const response = await api.get('/students');
            if (response.data.success) {
                setAllStudents(response.data.data);
            }
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setIsLoadingStudents(false);
        }
    };

    const loadSchoolProfile = () => {
        // Load from localStorage (primary source)
        const savedProfile = localStorage.getItem('school-profile');
        if (savedProfile) {
            try {
                const profile = JSON.parse(savedProfile);
                setSchoolProfile({
                    schoolName: profile.schoolName || 'Smart School',
                    address: profile.address || '',
                    phone: profile.phone || '',
                    logo: profile.logo || profile.logoUrl || null
                });
            } catch (error) {
                console.error('Failed to parse school profile:', error);
            }
        }
    };

    const loadReceipts = async () => {
        try {
            const response = await api.get('/inscriptions');
            if (response.data.success) {
                const apiInscriptions = response.data.data;
                const schoolAbbrev = getSchoolAbbrev();

                // Assign a clean sequential number per type+month+year (e.g. "ETSS 001/09/2026")
                // instead of a hex fragment of the Mongo id — inscriptions are processed in
                // chronological order so the sequence is stable across reloads.
                const sortedByDate = [...apiInscriptions].sort(
                    (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                const counters: Record<string, number> = {};

                const mappedByDate: Receipt[] = sortedByDate.map((ins: any) => {
                    const insDate = new Date(ins.date);
                    const mm = String(insDate.getMonth() + 1).padStart(2, '0');
                    const yyyy = insDate.getFullYear();
                    const typeSuffix = ins.type === 'SOUTIEN' ? 'SS' : 'FP';
                    const counterKey = `${typeSuffix}-${mm}-${yyyy}`;
                    counters[counterKey] = (counters[counterKey] || 0) + 1;
                    const seq = String(counters[counterKey]).padStart(3, '0');

                    return {
                        id: ins.id,
                        date: ins.date.substring(0, 10),
                        time: new Date(ins.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                        receiptNumber: `${schoolAbbrev}${typeSuffix} ${seq}/${mm}/${yyyy}`,
                        issuedTo: `${ins.student?.name || ''} ${ins.student?.surname || ''}`.trim() || 'Inconnu',
                        phoneNumber: ins.student?.phone || ins.student?.parentPhone || '',
                        items: [{ description: ins.category, amount: ins.amount }],
                        totalAmount: ins.amount,
                        amountPaid: ins.amount,
                        paymentMethod: 'Cash',
                        receiptType: ins.type === 'SOUTIEN' ? 'Soutien' : ins.type === 'FORMATION' ? 'Formation' : 'Other',
                        notes: ins.note || '',
                    };
                });
                setReceipts(mappedByDate);
            } else {
                // Fallback to localStorage if API fails or returns no success
                const stored = localStorage.getItem('receipts');
                if (stored) setReceipts(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading receipts:', error);
            // Fallback
            const stored = localStorage.getItem('receipts');
            if (stored) setReceipts(JSON.parse(stored));
        }
    };

    const saveReceipts = async (updatedReceipts: Receipt[]) => {
        // Since we are now primarily using the API for loading, 
        // saveReceipts might want to call the API to create an inscription too.
        // For simplicity in this step, we'll keep the localStorage fallback but focus on API data.
        localStorage.setItem('receipts', JSON.stringify(updatedReceipts));
        // Refresh from API to be sure
        await loadReceipts();
    };

    const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Derives a short prefix from the school's own name (e.g. "École Tafoghat" -> "ET"),
    // instead of the hardcoded "injahi" left over from the original single-school app.
    const getSchoolAbbrev = () => {
        let name = schoolProfile.schoolName;
        try {
            const saved = localStorage.getItem('school-profile');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.schoolName) name = parsed.schoolName;
            }
        } catch {
            // ignore malformed localStorage value, fall back to state
        }

        const letters = stripAccents(name || 'Ecole')
            .trim()
            .split(/\s+/)
            .map(w => w[0])
            .filter(Boolean)
            .join('')
            .toUpperCase();

        return letters.slice(0, 4) || 'ETB';
    };

    const generateReceiptNumber = (type: 'Soutien' | 'Formation' | 'Other') => {
        const schoolAbbrev = getSchoolAbbrev();
        const typeSuffix = type === 'Soutien' ? 'SS' : type === 'Formation' ? 'FP' : 'REC';
        const prefix = `${schoolAbbrev}${typeSuffix}`;

        const now = new Date();
        const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        // Same type AND same month/year — the sequence resets every month, matching loadReceipts.
        const relevantReceipts = receipts.filter(r => r.receiptNumber.startsWith(prefix) && r.receiptNumber.endsWith(`/${monthYear}`));

        let maxNum = 0;
        relevantReceipts.forEach(r => {
            const parts = r.receiptNumber.split(' ');
            if (parts.length === 2) {
                const num = parseInt(parts[1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });

        // Format: Prefix + Space + 3 digits + /month/year (e.g., ETSS 001/09/2026)
        return `${prefix} ${String(maxNum + 1).padStart(3, '0')}/${monthYear}`;
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const receiptData: Receipt = {
            id: editingReceipt?.id || Date.now(),
            date: formData.date,
            time: formData.time,
            receiptNumber: formData.receiptNumber,
            issuedTo: formData.issuedTo,
            phoneNumber: formData.phoneNumber,
            items: formData.items,
            totalAmount,
            amountPaid: parseFloat(formData.amountPaid) || totalAmount,
            paymentMethod: formData.paymentMethod,
            receiptType: formData.receiptType,
            checkNumber: formData.checkNumber,
            notes: formData.notes,
        };

        if (editingReceipt) {
            const updated = receipts.map(r => r.id === editingReceipt.id ? receiptData : r);
            saveReceipts(updated);
        } else {
            saveReceipts([...receipts, receiptData]);
        }

        setView('list');
        setEditingReceipt(null);
        setFormData(initialFormState);
    };

    const handleDelete = (receipt: Receipt) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer ce reçu?')) {
            saveReceipts(receipts.filter(r => r.id !== receipt.id));
        }
    };

    const handlePrint = (receipt: Receipt) => {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) return;

        const currentDate = new Date(receipt.date).toLocaleDateString('fr-FR');
        const currentTime = receipt.time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const remaining = receipt.totalAmount - receipt.amountPaid;
        const isPaidInFull = remaining <= 0;
        const items = receipt.items.map(item =>
            `<div class="flex"><span>${item.description}</span><span>${item.amount.toFixed(2)} MAD</span></div>`
        ).join('');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reçu - ${receipt.receiptNumber}</title>
                <style>
                    @page { size: 80mm auto; margin: 0; }
                    body {
                        font-family: monospace;
                        font-size: 12px;
                        width: 80mm;
                        margin: 0;
                        padding: 8mm 6mm;
                        color: #111;
                    }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .header { font-size: 14px; margin-bottom: 2px; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .small { font-size: 10px; color: #444; }
                    .medium { font-size: 11px; }
                    .accent-bar { height: 2px; background: #16a34a; border-radius: 2px; margin: 6px 0 8px; }
                    .title-box {
                        display: inline-block;
                        border: 1px solid #16a34a;
                        border-radius: 4px;
                        padding: 3px 8px;
                        font-size: 10px;
                        font-weight: bold;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                        color: #16a34a;
                        text-align: center;
                        white-space: nowrap;
                    }
                    .dashed { border-top: 1px dashed #999; margin: 8px 0; }
                    .flex { display: flex; justify-content: space-between; gap: 8px; }
                    .mt-20 { margin-top: 16px; }
                    .totals-box {
                        background: #f5f5f5;
                        border-radius: 6px;
                        padding: 6px 8px;
                    }
                    .remaining {
                        font-size: 13px;
                        color: ${isPaidInFull ? '#16a34a' : '#dc2626'};
                    }
                </style>
            </head>
            <body>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                        ${schoolProfile.logo ? `<img src="${schoolProfile.logo}" style="width: 40px; height: 40px; object-fit: contain; flex-shrink: 0;" />` : ''}
                        <div style="min-width: 0;">
                            <div class="header bold">${schoolProfile.schoolName}</div>
                            <div class="small">${schoolProfile.address}</div>
                            <div class="small">Tel: ${schoolProfile.phone}</div>
                        </div>
                    </div>
                    <span class="title-box">Reçu de<br/>${receipt.receiptType}</span>
                </div>
                <div class="accent-bar"></div>

                <div class="medium">
                    <div>Date: ${currentDate} ${currentTime}</div>
                    <div class="bold">No: ${receipt.receiptNumber}</div>
                </div>
                <div class="dashed"></div>

                <div class="medium">
                    <div>Client: ${receipt.issuedTo}</div>
                    <div>Tel: ${receipt.phoneNumber || 'N/A'}</div>
                    <div>Paiement: ${receipt.paymentMethod}</div>
                    ${receipt.paymentMethod === 'Check' && receipt.checkNumber ? `<div>Chèque No: ${receipt.checkNumber}</div>` : ''}
                </div>
                <div class="dashed"></div>

                <div class="flex bold medium">
                    <span>Description</span>
                    <span>Montant</span>
                </div>
                <div class="dashed"></div>

                <div class="medium">
                    ${items}
                </div>
                <div class="dashed"></div>

                <div class="medium totals-box">
                    <div class="flex"><span>Total:</span><span class="bold">${receipt.totalAmount.toFixed(2)} MAD</span></div>
                    <div class="flex"><span>Payé:</span><span class="bold">${receipt.amountPaid.toFixed(2)} MAD</span></div>
                    <div class="flex remaining"><span class="bold">Reste:</span><span class="bold">${remaining.toFixed(2)} MAD</span></div>
                </div>

                <div class="center medium mt-20">${schoolProfile.schoolName} vous remercie pour votre paiement!</div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const addItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { description: '', amount: 0 }]
        }));
    };

    const removeItem = (index: number) => {
        if (formData.items.length > 1) {
            setFormData(prev => ({
                ...prev,
                items: prev.items.filter((_, i) => i !== index)
            }));
        }
    };

    const handleItemChange = (index: number, field: 'description' | 'amount', value: string) => {
        const newItems = [...formData.items];
        if (field === 'amount') {
            newItems[index] = { ...newItems[index], amount: Number(value) };
        } else {
            newItems[index] = { ...newItems[index], description: value };
        }
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const filteredStudents = useMemo(() => {
        let students = allStudents;

        // Filter by type
        if (formData.receiptType === 'Soutien') {
            students = students.filter(s => s.inscriptions?.some((i: any) => i.type === 'SOUTIEN'));
        } else if (formData.receiptType === 'Formation') {
            students = students.filter(s => s.inscriptions?.some((i: any) => i.type === 'FORMATION'));
        }

        // Filter by search term
        if (studentSearchSubTerm) {
            const term = studentSearchSubTerm.toLowerCase();
            students = students.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.surname.toLowerCase().includes(term)
            );
        }

        return students;
    }, [allStudents, formData.receiptType, studentSearchSubTerm]);

    const filteredReceipts = useMemo(() => {
        return receipts.filter(r => {
            const matchesSearch = r.issuedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesDate = !filterDate || r.date === filterDate;
            const matchesMonth = !filterMonth || r.date.startsWith(filterMonth);

            return matchesSearch && matchesDate && matchesMonth;
        });
    }, [receipts, searchTerm, filterDate, filterMonth]);

    const organizedReceipts = useMemo(() => {
        const sorted = [...filteredReceipts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return {
            Soutien: sorted.filter(r => r.receiptType === 'Soutien'),
            Formation: sorted.filter(r => r.receiptType === 'Formation'),
            Other: sorted.filter(r => r.receiptType === 'Other')
        };
    }, [filteredReceipts]);

    const renderReceiptCard = (receipt: Receipt) => (
        <div key={receipt.id} className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group">
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-lg text-green-600">{receipt.receiptNumber}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <Calendar size={14} /> {new Date(receipt.date).toLocaleDateString('fr-FR')}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-xl text-gray-800">{receipt.totalAmount.toFixed(2)} DH</div>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full mt-1 inline-block ${receipt.receiptType === 'Soutien'
                            ? 'bg-blue-100 text-blue-800'
                            : receipt.receiptType === 'Formation'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                            {receipt.receiptType}
                        </span>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-200 text-sm space-y-2">
                    <p className="flex items-center gap-2 text-gray-700">
                        <User size={14} /> <strong>Client:</strong> {receipt.issuedTo}
                    </p>
                    {receipt.phoneNumber && (
                        <p className="flex items-center gap-2 text-gray-700">
                            <Phone size={14} /> {receipt.phoneNumber}
                        </p>
                    )}
                    <p className="flex items-center gap-2 text-gray-700">
                        <CreditCard size={14} /> {receipt.paymentMethod}
                    </p>
                </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 flex justify-end gap-2 transition-opacity opacity-0 group-hover:opacity-100">
                <button
                    onClick={() => setViewingReceipt(receipt)}
                    className="p-2 text-green-600 hover:bg-green-100 rounded-full"
                    title="Voir"
                >
                    <Eye size={18} />
                </button>
                <button
                    onClick={() => handlePrint(receipt)}
                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-full"
                    title="Imprimer"
                >
                    <Printer size={18} />
                </button>
                <button
                    onClick={() => {
                        setEditingReceipt(receipt);
                        setFormData({
                            date: receipt.date,
                            time: receipt.time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                            receiptNumber: receipt.receiptNumber,
                            issuedTo: receipt.issuedTo,
                            phoneNumber: receipt.phoneNumber || '',
                            items: receipt.items,
                            amountPaid: String(receipt.amountPaid),
                            paymentMethod: receipt.paymentMethod,
                            receiptType: receipt.receiptType,
                            checkNumber: receipt.checkNumber || '',
                            notes: receipt.notes || '',
                        });
                        setView('form');
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                    title="Modifier"
                >
                    <Edit size={18} />
                </button>
                <button
                    onClick={() => handleDelete(receipt)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                    title="Supprimer"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );

    const renderListView = () => (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Reçus</h1>
                <Button onClick={() => {
                    const defaultType = 'Soutien';
                    setFormData({
                        ...initialFormState,
                        receiptType: defaultType,
                        receiptNumber: generateReceiptNumber(defaultType)
                    });
                    setView('form');
                }} className="w-full sm:w-auto flex items-center gap-2">
                    <PlusCircle size={18} /> Nouveau Reçu
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Rechercher par nom ou numéro..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all duration-300"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={e => { setFilterDate(e.target.value); setFilterMonth(''); }}
                            className="pl-9 pr-3 py-2 border-2 border-gray-100 rounded-lg text-sm focus:border-blue-400 focus:outline-none transition-all"
                        />
                    </div>
                    <div className="relative">
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={e => { setFilterMonth(e.target.value); setFilterDate(''); }}
                            className="px-3 py-2 border-2 border-gray-100 rounded-lg text-sm focus:border-blue-400 focus:outline-none transition-all"
                        />
                    </div>
                    {(searchTerm || filterDate || filterMonth) && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setFilterDate('');
                                setFilterMonth('');
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-12">
                {/* Soutien Section */}
                {organizedReceipts.Soutien.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-4 border-l-4 border-blue-500 pl-3">
                            <h2 className="text-xl font-bold text-gray-800">Soutien Scolaire</h2>
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {organizedReceipts.Soutien.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {organizedReceipts.Soutien.map(receipt => renderReceiptCard(receipt))}
                        </div>
                    </div>
                )}

                {/* Formation Pro Section */}
                {organizedReceipts.Formation.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-4 border-l-4 border-green-500 pl-3">
                            <h2 className="text-xl font-bold text-gray-800">Formation Pro</h2>
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {organizedReceipts.Formation.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {organizedReceipts.Formation.map(receipt => renderReceiptCard(receipt))}
                        </div>
                    </div>
                )}

                {/* Other Section */}
                {organizedReceipts.Other.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-4 border-l-4 border-purple-500 pl-3">
                            <h2 className="text-xl font-bold text-gray-800">Autres Reçus</h2>
                            <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                {organizedReceipts.Other.length}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {organizedReceipts.Other.map(receipt => renderReceiptCard(receipt))}
                        </div>
                    </div>
                )}

                {filteredReceipts.length === 0 && (
                    <div className="text-center py-12">
                        <FileText size={64} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 text-lg">Aucun reçu trouvé</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderFormView = () => (
        <div className="space-y-6">
            <button
                onClick={() => { setView('list'); setEditingReceipt(null); setFormData(initialFormState); }}
                className="flex items-center gap-2 text-gray-600 hover:text-green-600 font-medium"
            >
                <ArrowLeft size={18} /> Retour aux reçus
            </button>

            <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                    <h1 className="text-3xl font-bold">{editingReceipt ? 'Modifier le Reçu' : 'Nouveau Reçu'}</h1>
                    <p className="opacity-90 mt-1">Remplissez les informations du reçu</p>
                </div>

                <div className="p-6 space-y-8">
                    {/* Receipt Type */}
                    <div className="border-2 border-green-200 rounded-lg p-6">
                        <h3 className="font-bold text-lg text-green-600 mb-4">Type de Reçu</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { value: 'Soutien', label: 'Soutien', icon: <GraduationCap size={24} /> },
                                { value: 'Formation', label: 'Formation Pro', icon: <FileText size={24} /> },
                                { value: 'Other', label: 'Autre', icon: <CheckCircle size={24} /> },
                            ].map(type => (
                                <label
                                    key={type.value}
                                    className={`flex flex-col items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.receiptType === type.value
                                        ? 'border-green-500 bg-green-50 text-green-600'
                                        : 'border-gray-200 hover:border-green-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="receiptType"
                                        value={type.value}
                                        checked={formData.receiptType === type.value}
                                        onChange={e => {
                                            const newType = e.target.value as any;
                                            const nextNumber = generateReceiptNumber(newType);
                                            setFormData({
                                                ...formData,
                                                receiptType: newType,
                                                receiptNumber: nextNumber, // Auto-update number
                                                items: [{ description: '', amount: 0 }],
                                                amountPaid: ''
                                            });
                                        }}
                                        className="sr-only"
                                    />
                                    {type.icon}
                                    <span className="font-semibold text-sm">{type.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* General Information */}
                    <div className="border-2 border-indigo-200 rounded-lg p-6">
                        <h3 className="font-bold text-lg text-indigo-600 mb-4">Informations Générales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Client *</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.issuedTo || studentSearchSubTerm}
                                        onChange={e => {
                                            setStudentSearchSubTerm(e.target.value);
                                            setFormData({ ...formData, issuedTo: e.target.value });
                                            setShowStudentDropdown(true);
                                        }}
                                        onFocus={() => setShowStudentDropdown(true)}
                                        placeholder="Rechercher un étudiant..."
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                        required
                                    />
                                    {showStudentDropdown && filteredStudents.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                            {filteredStudents.map(student => (
                                                <div
                                                    key={student.id}
                                                    className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b last:border-0 transition-colors"
                                                    onClick={() => {
                                                        const name = `${student.name} ${student.surname}`;
                                                        const phone = student.phone || student.parentPhone || '';

                                                        let newItems = [{ description: '', amount: 0 }];
                                                        if (formData.receiptType === 'Formation') {
                                                            const formationsInscriptions = student.inscriptions?.filter((i: any) => i.type === 'FORMATION');
                                                            if (formationsInscriptions && formationsInscriptions.length > 0) {
                                                                newItems = formationsInscriptions.map((i: any) => ({
                                                                    description: `Formation: ${i.category || 'N/A'}`,
                                                                    amount: i.amount || 0
                                                                }));
                                                            }
                                                        } else if (formData.receiptType === 'Soutien') {
                                                            const soutienInscriptions = student.inscriptions?.filter((i: any) => i.type === 'SOUTIEN');
                                                            if (soutienInscriptions && soutienInscriptions.length > 0) {
                                                                newItems = soutienInscriptions.map((i: any) => ({
                                                                    description: `Soutien: ${i.category || 'N/A'}`,
                                                                    amount: i.amount || 0
                                                                }));
                                                            }
                                                        }

                                                        const total = newItems.reduce((acc, item) => acc + item.amount, 0);

                                                        setFormData({
                                                            ...formData,
                                                            issuedTo: name,
                                                            phoneNumber: phone,
                                                            items: newItems,
                                                            amountPaid: total > 0 ? String(total) : ''
                                                        });
                                                        setStudentSearchSubTerm('');
                                                        setShowStudentDropdown(false);
                                                    }}
                                                >
                                                    <div className="font-bold text-gray-800">{student.name} {student.surname}</div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                        <Phone size={12} /> {student.phone || student.parentPhone || 'Pas de téléphone'}
                                                        <span className="mx-1">•</span>
                                                        <GraduationCap size={12} /> {student.schoolLevel || 'N/A'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {showStudentDropdown && studentSearchSubTerm && filteredStudents.length === 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-center text-gray-500 text-sm">
                                            Aucun étudiant trouvé pour ce type
                                        </div>
                                    )}
                                </div>
                                {showStudentDropdown && (
                                    <div
                                        className="fixed inset-0 z-0"
                                        onClick={() => setShowStudentDropdown(false)}
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                                <input
                                    type="tel"
                                    value={formData.phoneNumber}
                                    onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Heure</label>
                                <input
                                    type="time"
                                    value={formData.time}
                                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de Reçu *</label>
                                <input
                                    type="text"
                                    value={formData.receiptNumber}
                                    onChange={e => setFormData({ ...formData, receiptNumber: e.target.value })}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Receipt Type */}
                    <div className="border-2 border-green-200 rounded-lg p-6">
                        <h3 className="font-bold text-lg text-green-600 mb-4">Type de Reçu</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { value: 'Soutien', label: 'Soutien', icon: <GraduationCap size={24} /> },
                                { value: 'Formation', label: 'Formation Pro', icon: <FileText size={24} /> },
                                { value: 'Other', label: 'Autre', icon: <CheckCircle size={24} /> },
                            ].map(type => (
                                <label
                                    key={type.value}
                                    className={`flex flex-col items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.receiptType === type.value
                                        ? 'border-green-500 bg-green-50 text-green-600'
                                        : 'border-gray-200 hover:border-green-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="receiptType"
                                        value={type.value}
                                        checked={formData.receiptType === type.value}
                                        onChange={e => {
                                            const newType = e.target.value as any;
                                            const nextNumber = generateReceiptNumber(newType);
                                            setFormData({
                                                ...formData,
                                                receiptType: newType,
                                                receiptNumber: nextNumber, // Auto-update number
                                                items: [{ description: '', amount: 0 }],
                                                amountPaid: ''
                                            });
                                        }}
                                        className="sr-only"
                                    />
                                    {type.icon}
                                    <span className="font-semibold text-sm">{type.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Items */}
                    <div className="border-2 border-teal-200 rounded-lg p-6">
                        <h3 className="font-bold text-lg text-teal-600 mb-4">Articles et Services</h3>
                        <div className="space-y-4">
                            {formData.items.map((item, index) => (
                                <div key={index} className="p-4 border rounded-lg bg-gray-50 relative group">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Description</label>
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={e => handleItemChange(index, 'description', e.target.value)}
                                                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1">Montant (DH)</label>
                                            <input
                                                type="number"
                                                value={item.amount || ''}
                                                onChange={e => handleItemChange(index, 'amount', e.target.value)}
                                                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                    {formData.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(index)}
                                            className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={addItem}
                            className="mt-4 text-sm font-medium text-green-600 hover:underline flex items-center gap-1"
                        >
                            <PlusCircle size={14} /> Ajouter un article
                        </button>
                    </div>

                    {/* Payment */}
                    <div className="border-2 border-amber-200 rounded-lg p-6">
                        <h3 className="font-bold text-lg text-amber-600 mb-4">Paiement et Résumé</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Mode de Paiement</label>
                                    <select
                                        value={formData.paymentMethod}
                                        onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                    >
                                        <option value="Cash">Espèces</option>
                                        <option value="Check">Chèque</option>
                                    </select>
                                </div>
                                {formData.paymentMethod === 'Check' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de Chèque</label>
                                        <input
                                            type="text"
                                            value={formData.checkNumber}
                                            onChange={e => setFormData({ ...formData, checkNumber: e.target.value })}
                                            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Montant Payé (DH)</label>
                                    <input
                                        type="number"
                                        value={formData.amountPaid}
                                        onChange={e => setFormData({ ...formData, amountPaid: e.target.value })}
                                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200"
                                        step="0.01"
                                        placeholder={totalAmount.toFixed(2)}
                                    />
                                </div>
                            </div>
                            <div className="bg-gray-100 p-6 rounded-lg space-y-3 flex flex-col justify-center">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-600">Total</span>
                                    <span className="font-bold text-lg text-gray-800">{totalAmount.toFixed(2)} DH</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-600">Montant Payé</span>
                                    <span className="font-bold text-lg text-green-600">{(parseFloat(formData.amountPaid) || 0).toFixed(2)} DH</span>
                                </div>
                                <div className="border-t-2 border-dashed my-2"></div>
                                <div className="flex justify-between items-baseline">
                                    <span className="font-bold text-gray-800">Reste</span>
                                    <span className="font-bold text-2xl text-green-600">
                                        {(totalAmount - (parseFloat(formData.amountPaid) || 0)).toFixed(2)} DH
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50 border-t flex justify-between items-center">
                    <button
                        type="button"
                        onClick={() => { setView('list'); setEditingReceipt(null); setFormData(initialFormState); }}
                        className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                    >
                        Enregistrer le Reçu
                    </button>
                </div>
            </form>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
            <div className="max-w-7xl mx-auto">
                {view === 'list' ? renderListView() : renderFormView()}

                {/* View Receipt Modal */}
                {viewingReceipt && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center p-4 border-b">
                                <h2 className="text-lg font-bold text-gray-900">Aperçu du Reçu</h2>
                                <button onClick={() => setViewingReceipt(null)} className="text-gray-400 hover:text-gray-600">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-8 bg-gray-100 flex justify-center">
                                <div className="bg-white p-4 shadow-md rounded-lg text-black font-mono text-sm w-[300px]" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {schoolProfile.logo && (
                                                <img src={schoolProfile.logo} alt="Logo" className="w-10 h-10 object-contain shrink-0" />
                                            )}
                                            <div className="min-w-0">
                                                <div className="font-bold tracking-wide truncate">{schoolProfile.schoolName}</div>
                                                <div className="text-[9px] text-gray-500 truncate">{schoolProfile.address}</div>
                                                <div className="text-[9px] text-gray-500">Tel: {schoolProfile.phone}</div>
                                            </div>
                                        </div>
                                        <span className="shrink-0 inline-block border border-green-600 text-green-600 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-center">
                                            Reçu de<br />{viewingReceipt.receiptType}
                                        </span>
                                    </div>
                                    <div className="h-[3px] bg-green-600 rounded-full my-2"></div>

                                    <div className="text-xs space-y-0.5">
                                        <div>Date: {new Date(viewingReceipt.date).toLocaleDateString('fr-FR')} {viewingReceipt.time || ''}</div>
                                        <div className="font-bold">No: {viewingReceipt.receiptNumber}</div>
                                    </div>

                                    <div className="border-b border-dashed border-gray-400 my-2"></div>

                                    <div className="text-xs space-y-1">
                                        <div>{viewingReceipt.issuedTo}</div>
                                        <div>Tel: {viewingReceipt.phoneNumber || 'N/A'}</div>
                                        <div>Paiement: {viewingReceipt.paymentMethod}</div>
                                        {viewingReceipt.paymentMethod === 'Check' && viewingReceipt.checkNumber && (
                                            <div>Chèque No: {viewingReceipt.checkNumber}</div>
                                        )}
                                    </div>

                                    <div className="border-b border-dashed border-gray-400 my-2"></div>

                                    <div className="flex justify-between font-bold text-xs mb-1">
                                        <span>Description</span>
                                        <span>Montant</span>
                                    </div>
                                    <div className="border-b border-dashed border-gray-400 mb-2"></div>

                                    <div className="space-y-1 mb-2">
                                        {viewingReceipt.items.map((item, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span>{item.description}</span>
                                                <span>{item.amount.toFixed(2)} MAD</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="border-b border-dashed border-gray-400 my-2"></div>

                                    {(() => {
                                        const remaining = viewingReceipt.totalAmount - viewingReceipt.amountPaid;
                                        const isPaidInFull = remaining <= 0;
                                        return (
                                            <div className="text-xs space-y-1 bg-gray-100 rounded-md px-2.5 py-2">
                                                <div className="flex justify-between">
                                                    <span>Total:</span>
                                                    <span className="font-bold">{viewingReceipt.totalAmount.toFixed(2)} MAD</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Payé:</span>
                                                    <span className="font-bold">{viewingReceipt.amountPaid.toFixed(2)} MAD</span>
                                                </div>
                                                <div className={`flex justify-between font-bold ${isPaidInFull ? 'text-green-600' : 'text-red-600'}`}>
                                                    <span>Reste:</span>
                                                    <span>{remaining.toFixed(2)} MAD</span>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="text-center text-xs mt-4 mb-2">{schoolProfile.schoolName} vous remercie pour votre paiement!</div>
                                </div>
                            </div>

                            <div className="p-4 border-t bg-gray-50 flex gap-3">
                                <button
                                    onClick={() => handlePrint(viewingReceipt)}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                                >
                                    <Printer size={18} /> Imprimer
                                </button>
                                <button
                                    onClick={() => setViewingReceipt(null)}
                                    className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
