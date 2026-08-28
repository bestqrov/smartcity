
'use client';

import { useState } from 'react';
import { DollarSign, Save, Check, X, Edit2 } from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';

import { formationsService } from '@/lib/services/formations';
import { useRouter } from 'next/navigation';

export default function NouvelleFormationsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        duration: '',
        price: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await formationsService.create({
                name: formData.name,
                duration: formData.duration,
                price: parseFloat(formData.price),
            });
            // Reset form and redirect or show success
            setFormData({ name: '', duration: '', price: '' });
            alert('Formation ajoutée avec succès !');
            router.push('/admin/formation-pro/inscription');
        } catch (err) {
            console.error(err);
            setError('Erreur lors de la création de la formation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-100 p-2 rounded-lg">
                    <DollarSign className="text-orange-600" size={24} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Nouvelle Formation</h2>
            </div>
            {error && <div className="p-3 mb-4 text-red-700 bg-red-100 rounded-lg">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label={<span>Nom de la formation <span className="text-red-500">*</span></span>}
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Ex: Marketing Digital"
                />
                <Input
                    label={<span>Durée (ex: 3 mois) <span className="text-red-500">*</span></span>}
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    required
                    placeholder="Durée de la formation"
                />
                <Input
                    label={<span>Prix (DH) <span className="text-red-500">*</span></span>}
                    name="price"
                    type="number"
                    value={formData.price}
                    onChange={handleChange}
                    required
                    placeholder="Ex: 500"
                />
                <div className="flex justify-end mt-4">
                    <Button type="submit" className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2">
                        <Save size={18} />
                        Ajouter
                    </Button>
                </div>
            </form>
        </div>
    );
}
