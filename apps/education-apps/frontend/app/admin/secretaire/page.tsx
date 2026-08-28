'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { secretaryService, Secretary } from '@/lib/services/secretary';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { UserCog, Save, AlertCircle, CheckCircle, Lock, Mail, User as UserIcon } from 'lucide-react';

export default function SecretairePage() {
    const router = useRouter();
    const [secretary, setSecretary] = useState<Secretary | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        gsm: '',
        whatsapp: '',
        address: '',
        schoolLevel: '',
        certification: '',
    });

    useEffect(() => {
        fetchSecretary();
    }, []);

    const fetchSecretary = async () => {
        try {
            setLoading(true);
            const secretaries = await secretaryService.getSecretaries();
            if (secretaries.length > 0) {
                const sec = secretaries[0];
                setSecretary(sec);
                setFormData({
                    name: sec.name,
                    email: sec.email,
                    password: '',
                    confirmPassword: '',
                    gsm: sec.gsm || '',
                    whatsapp: sec.whatsapp || '',
                    address: sec.address || '',
                    schoolLevel: sec.schoolLevel || '',
                    certification: sec.certification || '',
                });
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch secretary');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validate passwords if changing
        if (formData.password || formData.confirmPassword) {
            if (formData.password !== formData.confirmPassword) {
                setError('Passwords do not match');
                return;
            }
            if (formData.password.length < 6) {
                setError('Password must be at least 6 characters');
                return;
            }
        }

        if (!secretary) {
            setError('No secretary account found');
            return;
        }

        try {
            setSaving(true);
            const updateData: any = {
                name: formData.name,
                email: formData.email,
                gsm: formData.gsm,
                whatsapp: formData.whatsapp,
                address: formData.address,
                schoolLevel: formData.schoolLevel,
                certification: formData.certification,
            };

            // Only include password if it's being changed
            if (formData.password) {
                updateData.password = formData.password;
            }

            await secretaryService.updateSecretary(secretary.id, updateData);
            setSuccess('Secretary account updated successfully');

            // Clear password fields
            setFormData((prev) => ({
                ...prev,
                password: '',
                confirmPassword: '',
            }));

            // Refresh secretary data
            await fetchSecretary();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update secretary');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!secretary) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Gestion Secrétaire</h1>
                        <p className="text-gray-600 mt-1">Gérer le compte secrétaire</p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-lg">
                        <UserCog className="text-purple-600" size={32} />
                    </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
                    <AlertCircle className="mx-auto mb-4 text-yellow-600" size={48} />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Aucun compte secrétaire trouvé</h3>
                    <p className="text-gray-600">
                        Il n'y a actuellement aucun compte secrétaire dans le système.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Gestion Secrétaire</h1>
                    <p className="text-gray-600 mt-1">Modifier les informations du compte secrétaire</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                    <UserCog className="text-purple-600" size={32} />
                </div>
            </div>

            {/* Info Alert */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Limite de compte</p>
                    <p>Le système autorise un seul compte secrétaire. Vous pouvez modifier les informations de connexion ci-dessous.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 text-green-600 p-4 rounded-xl border border-green-100 flex items-center gap-3">
                    <CheckCircle size={20} />
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
                <div className="space-y-6">
                    {/* Name Field */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                            <UserIcon size={16} />
                            Nom complet
                        </label>
                        <Input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="Nom du secrétaire"
                            className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
                        />
                    </div>

                    {/* Email Field */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                            <Mail size={16} />
                            Email (Login)
                        </label>
                        <Input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder="email@example.com"
                            className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
                        />
                    </div>

                    {/* New Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">GSM</label>
                            <Input
                                name="gsm"
                                value={formData.gsm}
                                onChange={handleChange}
                                placeholder="06 00 00 00 00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">WhatsApp</label>
                            <Input
                                name="whatsapp"
                                value={formData.whatsapp}
                                onChange={handleChange}
                                placeholder="06 00 00 00 00"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Adresse</label>
                        <Input
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Adresse complète"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Niveau Scolaire</label>
                            <Input
                                name="schoolLevel"
                                value={formData.schoolLevel}
                                onChange={handleChange}
                                placeholder="Ex: Bac+3"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Certification</label>
                            <Input
                                name="certification"
                                value={formData.certification}
                                onChange={handleChange}
                                placeholder="Ex: Diplôme de Secrétariat"
                            />
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
                            <Lock size={20} />
                            Changer le mot de passe (optionnel)
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Laissez vide si vous ne souhaitez pas modifier le mot de passe
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Password Field */}
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                                    Nouveau mot de passe
                                </label>
                                <Input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
                                />
                            </div>

                            {/* Confirm Password Field */}
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                                    Confirmer le mot de passe
                                </label>
                                <Input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="bg-gray-50 border-gray-200 focus:bg-white transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button
                            type="submit"
                            isLoading={saving}
                            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Save size={20} />
                            Enregistrer les modifications
                        </Button>
                    </div>
                </div>
            </form>

            {/* Account Info Card */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Informations du compte</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500">ID:</span>
                        <span className="ml-2 font-mono text-gray-800">{secretary.id}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Rôle:</span>
                        <span className="ml-2 font-semibold text-purple-600">{secretary.role}</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Créé le:</span>
                        <span className="ml-2 text-gray-800">{new Date(secretary.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
