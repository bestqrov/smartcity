'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Save, Clock, DollarSign } from 'lucide-react';
import Button from '@/components/Button';
import { formationsService } from '@/lib/services/formations';

export default function NewFormationPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        duration: '',
        price: '',
        description: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await formationsService.create({
                name: formData.name,
                duration: formData.duration,
                price: parseFloat(formData.price),
                description: formData.description || undefined,
            });

            alert('Formation créée avec succès !');
            router.push('/admin/formation-pro');
        } catch (error: any) {
            console.error('Formation creation failed:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de la création';
            alert(`Erreur: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-500 p-8 text-white">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                            <GraduationCap size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Nouvelle Formation</h1>
                            <p className="text-purple-100 mt-1">Créer une nouvelle formation professionnelle</p>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Formation Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-1">
                            Nom de la formation
                            <span className="text-red-500">*</span>
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <GraduationCap className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="Ex: Coiffure Professionnelle"
                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white hover:bg-white text-gray-800 placeholder-gray-400"
                            />
                        </div>
                    </div>

                    {/* Duration and Price */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Duration */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-1">
                                Durée
                                <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Clock className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleChange}
                                    required
                                    placeholder="Ex: 3 mois"
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white hover:bg-white text-gray-800 placeholder-gray-400"
                                />
                            </div>
                        </div>

                        {/* Price */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-1">
                                Prix (DH)
                                <span className="text-red-500">*</span>
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <DollarSign className="h-5 w-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                                </div>
                                <input
                                    type="number"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleChange}
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="Ex: 2500"
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white hover:bg-white text-gray-800 placeholder-gray-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 ml-1">
                            Description (optionnel)
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            placeholder="Décrivez brièvement la formation..."
                            className="block w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all bg-gray-50/50 focus:bg-white hover:bg-white text-gray-800 placeholder-gray-400 resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 flex gap-3">
                        <Button
                            type="button"
                            onClick={() => router.back()}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-all"
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white py-3 rounded-xl font-semibold shadow-lg shadow-purple-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Save size={20} />
                            {loading ? 'Création...' : 'Créer la Formation'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
