'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    User,
    Mail,
    Phone,
    MapPin,
    CreditCard,
    BookOpen,
    ShoppingCart,
    Check,
    Save,
    Smartphone,
    GraduationCap
} from 'lucide-react';
import Button from '@/components/Button';
import { formationsService, Formation } from '@/lib/services/formations';
import { createStudent } from '@/lib/services/students';
import { createInscription } from '@/lib/services/inscriptions';

// Helper component for modern inputs with icons
const ModernInput = ({ icon: Icon, label, required, ...props }: any) => (
    <div className="space-y-1.5">
        <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-1">
            {label}
            {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <input
                {...props}
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white hover:bg-white text-gray-800 placeholder-gray-400"
            />
        </div>
    </div>
);

interface FormationInscriptionFormProps {
    onSuccessRedirect?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function FormationInscriptionForm({ onSuccessRedirect, onSuccess, onCancel }: FormationInscriptionFormProps) {
    const router = useRouter();
    const [formations, setFormations] = useState<Formation[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        whatsapp: '',
        gsm: '',
        cin: '',
        address: '',
        formation: [] as string[],
    });

    useEffect(() => {
        const fetchFormations = async () => {
            try {
                const data = await formationsService.getAll();
                setFormations(data);
            } catch (error) {
                console.error('Error fetching formations:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchFormations();
    }, []);

    // Helper to get color/bg based on index
    const getStyle = (index: number) => {
        const styles = [
            { color: 'text-pink-500', bg: 'bg-pink-50' },
            { color: 'text-blue-500', bg: 'bg-blue-50' },
            { color: 'text-purple-500', bg: 'bg-purple-50' },
            { color: 'text-green-500', bg: 'bg-green-50' },
            { color: 'text-orange-500', bg: 'bg-orange-50' },
        ];
        return styles[index % styles.length];
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        if (name === 'formation' && type === 'checkbox') {
            setFormData(prev => {
                const current = prev.formation as string[];
                const newSelection = checked
                    ? [...current, value]
                    : current.filter(id => id !== value);
                return { ...prev, formation: newSelection };
            });
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);

            // Create an inscription for each selected formation
            await Promise.all(formData.formation.map(async (formationId) => {
                const formation = formations.find(f => f.id === formationId);
                if (!formation) return;

                // 1. Create Student
                const studentData = await createStudent({
                    name: formData.name.split(' ')[0],
                    surname: formData.name.split(' ').slice(1).join(' ') || '.',
                    email: formData.email,
                    phone: formData.gsm,
                    cin: formData.cin,
                    address: formData.address,
                } as any);

                // 2. Create Inscription
                await createInscription({
                    studentId: studentData.id,
                    type: 'FORMATION',
                    formationId: formation.id,
                    category: formation.name,
                    amount: formation.price,
                    note: `Inscription Formation: ${formation.name}`,
                    status: 'ACTIVE'
                } as any);
            }));

            if (onSuccess) {
                onSuccess();
            } else if (onSuccessRedirect) {
                router.push(onSuccessRedirect as string);
            }
        } catch (error: any) {
            console.error('Submission failed:', error);
            const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Une erreur est survenue';
            alert(`Erreur: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    const total = formData.formation.reduce((sum, id) => {
        const opt = formations.find(o => o.id === id);
        return sum + (opt?.price || 0);
    }, 0);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Form Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-8 text-white">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                                    <GraduationCap size={32} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold">Inscription</h1>
                                    <p className="text-blue-100 mt-1">Remplissez le formulaire pour vous inscrire</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-8">
                            {/* Personal Info Group */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                                    <User className="text-blue-500" size={20} />
                                    Informations Personnelles
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ModernInput
                                        icon={User}
                                        label="Nom Complet"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                        placeholder="Ex: Mohammed Alami"
                                    />
                                    <ModernInput
                                        icon={CreditCard}
                                        label="CIN"
                                        name="cin"
                                        value={formData.cin}
                                        onChange={handleChange}
                                        required
                                        placeholder="Ex: AB123456"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ModernInput
                                        icon={Mail}
                                        label="Email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        placeholder="exemple@email.com"
                                    />
                                    <ModernInput
                                        icon={MapPin}
                                        label="Adresse"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        required
                                        placeholder="Adresse complète"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ModernInput
                                        icon={Smartphone}
                                        label="WhatsApp"
                                        name="whatsapp"
                                        value={formData.whatsapp}
                                        onChange={handleChange}
                                        required
                                        placeholder="06..."
                                    />
                                    <ModernInput
                                        icon={Phone}
                                        label="GSM"
                                        name="gsm"
                                        value={formData.gsm}
                                        onChange={handleChange}
                                        required
                                        placeholder="06..."
                                    />
                                </div>
                            </div>

                            {/* Formations Selection */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                                    <BookOpen className="text-blue-500" size={20} />
                                    Choix des Formations
                                </h3>

                                {loading ? (
                                    <div className="text-center py-8 text-gray-500">Chargement des formations...</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {formations.map((opt, index) => {
                                            const isSelected = formData.formation.includes(opt.id);
                                            const style = getStyle(index);
                                            return (
                                                <label
                                                    key={opt.id}
                                                    className={`relative flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer group ${isSelected
                                                        ? 'border-blue-500 bg-blue-50/30'
                                                        : 'border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        name="formation"
                                                        value={opt.id}
                                                        checked={isSelected}
                                                        onChange={handleChange}
                                                        className="hidden"
                                                    />
                                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mr-4 transition-colors ${isSelected
                                                        ? 'bg-blue-500 border-blue-500'
                                                        : 'border-gray-300 group-hover:border-blue-400 bg-white'
                                                        }`}>
                                                        {isSelected && <Check size={14} className="text-white" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className={`font-bold text-lg ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                                            {opt.name}
                                                        </span>
                                                        <div className="text-sm text-gray-500">{opt.duration}</div>
                                                    </div>
                                                    <div className={`p-2 rounded-xl ${style.bg}`}>
                                                        <BookOpen size={20} className={style.color} />
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Actions with Cancel Button */}
                            <div className="pt-4 flex gap-4">
                                {onCancel && (
                                    <Button
                                        type="button"
                                        onClick={onCancel}
                                        className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-4 rounded-xl text-lg font-bold transition-all"
                                    >
                                        Annuler
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    className={`bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white py-4 rounded-xl text-lg font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${onCancel ? 'flex-[2]' : 'w-full'}`}
                                >
                                    <Save className="mr-2" size={20} />
                                    Confirmer l'Inscription
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Cart Summary Side Panel */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <div className="bg-gray-900 text-white rounded-3xl p-6 shadow-2xl overflow-hidden relative">
                            {/* Background decoration */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-800">
                                    <div className="p-3 bg-blue-500/20 rounded-xl">
                                        <ShoppingCart className="text-blue-400" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">Votre facture</h3>
                                        <p className="text-gray-400 text-sm">{formData.formation.length} formation(s)</p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8 min-h-[200px]">
                                    {formData.formation.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            <ShoppingCart size={48} className="mx-auto mb-3 opacity-20" />
                                            <p>Aucune formation sélectionnée</p>
                                        </div>
                                    ) : (
                                        formData.formation.map(id => {
                                            const opt = formations.find(o => o.id === id);
                                            return (
                                                <div key={id} className="flex justify-between items-center bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                                                    <span className="font-medium text-gray-200">{opt?.name}</span>
                                                    <span className="font-bold text-blue-400">{opt?.price} DH</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                                    <div className="flex justify-between items-end">
                                        <span className="text-gray-400 font-medium">Total à payer</span>
                                        <div className="text-right">
                                            <span className="text-3xl font-bold text-white block">{total}</span>
                                            <span className="text-sm text-gray-400 font-medium">Dirhams (DH)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
