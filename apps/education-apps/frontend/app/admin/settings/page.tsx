'use client';

import { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon,
    School,
    Palette,
    Database,
    Save,
    Download,
    Upload,
    CheckCircle,
    AlertCircle,
    Sun,
    Moon,
    Monitor,
    Users,
    Eye,
    EyeOff
} from 'lucide-react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import GradingPeriodsEditor from '@/components/grades/GradingPeriodsEditor';
import WhatsappAutoCard from '@/components/settings/WhatsappAutoCard';
import api from '@/lib/api';
import useAuthStore from '@/store/useAuthStore';
import { getMySchool, updateMySchool } from '@/lib/services/schools';

import { useI18n } from '@/lib/i18n/I18nProvider';
interface User {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'SECRETARY';
    avatar?: string;
    gsm?: string;
    whatsapp?: string;
    address?: string;
    schoolLevel?: string;
    certification?: string;
}

export default function SettingsPage() {
    const { tr } = useI18n();
    const [activeTab, setActiveTab] = useState<'profile' | 'theme' | 'backup' | 'users'>('profile');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // School Profile State
    const [schoolProfile, setSchoolProfile] = useState({
        schoolName: 'ArwaEduc',
        city: '',
        address: '',
        phone: '',
        email: '',
        director: '',
        logo: '',
    });
    const [trialInfo, setTrialInfo] = useState<{ status: string; trialEndsAt: string | null } | null>(null);

    // Theme State
    const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
    const [accentColor, setAccentColor] = useState('#3B82F6');

    const authRole = useAuthStore((s) => s.user?.role);
    const canManageWhatsapp = authRole === 'ADMIN' || authRole === 'OWNER';

    // Users State
    const [adminUser, setAdminUser] = useState<User | null>(null);
    const [secretaryUser, setSecretaryUser] = useState<User | null>(null);
    const [adminPassword, setAdminPassword] = useState('');
    const [secretaryPassword, setSecretaryPassword] = useState('');
    const [showAdminPassword, setShowAdminPassword] = useState(false);
    const [showSecretaryPassword, setShowSecretaryPassword] = useState(false);

    // Load school profile from the backend on mount
    useEffect(() => {
        loadSchoolProfile();
        fetchUsers();
    }, []);

    const loadSchoolProfile = async () => {
        try {
            const school = await getMySchool();
            setSchoolProfile({
                schoolName: school.name || 'ArwaEduc',
                city: school.city || '',
                address: school.address || '',
                phone: school.phone || '',
                email: school.email || '',
                director: school.director || '',
                logo: school.logo || '',
            });
            setTrialInfo({ status: school.status, trialEndsAt: school.trialEndsAt });
        } catch (e) {
            console.error('Failed to load school profile', e);
        }
    };


    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            console.log('Fetching users with token:', token ? 'Token exists' : 'No token');

            if (!token) {
                setError(tr("Vous devez être connecté pour accéder à cette page."));
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
                return;
            }

            // Get current logged-in user (works for both ADMIN and SECRETARY)
            const meResponse = await api.get('/auth/me');

            const currentUser = meResponse.data.data;
            console.log('Current user:', currentUser);

            // If current user is ADMIN, set as admin user
            if (currentUser.role === 'ADMIN') {
                setAdminUser(currentUser);
            }

            // Try to fetch secretary user (only ADMIN can do this)
            try {
                const secretariesResponse = await api.get('/users/secretaries');

                const secretaries = secretariesResponse.data.data;
                console.log('Secretaries:', secretaries);

                if (secretaries && secretaries.length > 0) {
                    setSecretaryUser(secretaries[0]); // Get first secretary
                }
            } catch (secErr) {
                console.log('Could not fetch secretaries (might not be admin):', secErr);
                // If current user is SECRETARY, set as secretary user
                if (currentUser.role === 'SECRETARY') {
                    setSecretaryUser(currentUser);
                }
            }

        } catch (err: any) {
            console.error('Failed to fetch users', err);
            console.error('Error response:', err.response?.data);

            // Check if it's an authentication error
            if (err.response?.status === 401 || err.response?.data?.message?.includes('Authentication')) {
                setError(tr("Session expirée. Redirection..."));
                localStorage.removeItem('accessToken');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                setError(tr("Erreur lors du chargement des utilisateurs: {v0}", { v0: err.response?.data?.message || err.message }));
            }
        }
    };

    const handleSchoolProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSchoolProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveSchoolProfile = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await updateMySchool({
                name: schoolProfile.schoolName,
                director: schoolProfile.director,
                city: schoolProfile.city,
                address: schoolProfile.address,
                phone: schoolProfile.phone,
                email: schoolProfile.email,
                logo: schoolProfile.logo,
            });
            setSuccess(tr("Profil de l'école enregistré avec succès"));

            // Trigger a custom event to notify sidebar of logo change
            window.dispatchEvent(new Event('school-profile-updated'));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Échec de l\'enregistrement du profil');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTheme = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // TODO: Implement theme saving to localStorage or API
            localStorage.setItem('app-theme', theme);
            localStorage.setItem('accent-color', accentColor);
            await new Promise(resolve => setTimeout(resolve, 500));
            setSuccess(tr("Thème enregistré avec succès"));
        } catch (err: any) {
            setError(tr("Échec de l'enregistrement du thème"));
        } finally {
            setSaving(false);
        }
    };

    const handleBackup = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // TODO: Implement backup API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            setSuccess(tr("Sauvegarde créée avec succès"));
        } catch (err: any) {
            setError(tr("Échec de la création de la sauvegarde"));
        } finally {
            setSaving(false);
        }
    };

    const handleRestore = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // TODO: Implement restore API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            setSuccess(tr("Restauration effectuée avec succès"));
        } catch (err: any) {
            setError(tr("Échec de la restauration"));
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateUser = async (user: User | null, password?: string) => {
        if (!user) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('token');
            const data: any = {
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                gsm: user.gsm,
                whatsapp: user.whatsapp,
                address: user.address,
                schoolLevel: user.schoolLevel,
                certification: user.certification
            };

            if (password && password.trim() !== '') {
                data.password = password;
            }

            await api.put(`/users/${user.id}`, data);

            // If we updated the currently logged in user, refresh global state
            const currentUser = useAuthStore.getState().user;
            if (currentUser && currentUser.id === user.id) {
                await useAuthStore.getState().getMe();
            }

            setSuccess(tr("Compte {v0} mis à jour avec succès", { v0: user.role === 'ADMIN' ? 'Administrateur' : 'Secrétaire' }));
            if (user.role === 'ADMIN') setAdminPassword('');
            if (user.role === 'SECRETARY') setSecretaryPassword('');
            fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Échec de la mise à jour du compte');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'profile' as const, label: 'Profil École', icon: School },
        { id: 'users' as const, label: 'Utilisateurs', icon: Users },
        { id: 'theme' as const, label: 'Thème', icon: Palette },
        { id: 'backup' as const, label: 'Sauvegarde', icon: Database },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{tr("Paramètres")}</h1>
                    <p className="text-gray-600 mt-1">{tr("Gérer les paramètres de l'application")}</p>
                </div>
                <div className="hidden sm:block bg-blue-100 p-3 rounded-lg">
                    <SettingsIcon className="text-blue-600" size={32} />
                </div>
            </div>

            {/* Notifications */}
            {success && (
                <div className="bg-green-50 text-green-600 p-4 rounded-xl border border-green-100 flex items-center gap-3">
                    <CheckCircle size={20} />
                    {success}
                </div>
            )}

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
                    <AlertCircle size={20} />
                    {tr(error)}
                </div>
            )}

            {trialInfo && trialInfo.status === 'PENDING' && (() => {
                const expired = trialInfo.trialEndsAt ? new Date(trialInfo.trialEndsAt) < new Date() : false;
                const daysLeft = trialInfo.trialEndsAt
                    ? Math.max(0, Math.ceil((new Date(trialInfo.trialEndsAt).getTime() - Date.now()) / 86400000))
                    : null;
                return (
                    <div
                        className={`p-4 rounded-xl border flex items-center gap-3 ${
                            expired
                                ? 'bg-red-50 text-red-700 border-red-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}
                    >
                        <AlertCircle size={20} />
                        {expired
                            ? tr("Votre période d'essai de 15 jours est terminée. Contactez-nous pour activer votre école.")
                            : tr("Essai gratuit : il vous reste {daysLeft} jour(s).", { daysLeft })}
                    </div>
                );
            })()}

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    setSuccess('');
                                    setError('');
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-semibold transition-all ${activeTab === tab.id
                                    ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon size={20} />
                                {tr(tab.label)}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 sm:p-8">
                    {/* School Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">{tr("Profil de l'École")}</h2>
                                <p className="text-gray-600">{tr("Gérer les informations de l'établissement")}</p>
                            </div>

                            {/* Logo Upload Section */}
                            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <School size={20} />{tr("Logo de l'école")}</h3>
                                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                                    {/* Logo Preview */}
                                    <div className="flex-shrink-0">
                                        <div className="w-32 h-32 bg-white rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                                            {schoolProfile.logo ? (
                                                <img
                                                    src={schoolProfile.logo}
                                                    alt={tr("School Logo")}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="text-center text-gray-400">
                                                    <School size={40} className="mx-auto mb-2" />
                                                    <p className="text-xs">{tr("Aucun logo")}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Upload Controls */}
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-600 mb-3">{tr("Téléchargez le logo de votre établissement. Il sera affiché dans la barre latérale et sur tous les documents.")}</p>
                                        <div className="flex items-center gap-3">
                                            <label className="cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                setSchoolProfile(prev => ({
                                                                    ...prev,
                                                                    logo: reader.result as string
                                                                }));
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                                <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2">
                                                    <Upload size={18} />{tr("Télécharger un logo")}</div>
                                            </label>
                                            {schoolProfile.logo && (
                                                <button
                                                    onClick={() => setSchoolProfile(prev => ({ ...prev, logo: '' }))}
                                                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-semibold transition-colors"
                                                >{tr("Supprimer")}</button>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">{tr("Formats acceptés: JPG, PNG, SVG. Taille recommandée: 200x200px")}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label={tr("Nom de l'école")}
                                    name="schoolName"
                                    value={schoolProfile.schoolName}
                                    onChange={handleSchoolProfileChange}
                                    placeholder={tr("Nom de votre établissement")}
                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                />

                                <Input
                                    label={tr("Directeur")}
                                    name="director"
                                    value={schoolProfile.director}
                                    onChange={handleSchoolProfileChange}
                                    placeholder={tr("Nom du directeur")}
                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                />

                                <Input
                                    label={tr("Ville")}
                                    name="city"
                                    value={schoolProfile.city}
                                    onChange={handleSchoolProfileChange}
                                    placeholder={tr("ex: Ouarzazate")}
                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                />

                                <Input
                                    label={tr("Adresse")}
                                    name="address"
                                    value={schoolProfile.address}
                                    onChange={handleSchoolProfileChange}
                                    placeholder={tr("Adresse complète")}
                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                />

                                <Input
                                    label={tr("Téléphone")}
                                    name="phone"
                                    value={schoolProfile.phone}
                                    onChange={handleSchoolProfileChange}
                                    placeholder={tr("+212 XXX-XXXXXX")}
                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                />

                                <Input
                                    label={tr("Email")}
                                    name="email"
                                    type="email"
                                    value={schoolProfile.email}
                                    onChange={handleSchoolProfileChange}
                                    placeholder={tr("contact@votreecole.com")}
                                    className="bg-gray-50 border-gray-200 focus:bg-white"
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={handleSaveSchoolProfile}
                                    isLoading={saving}
                                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-bold"
                                >
                                    <Save size={20} />{tr("Enregistrer le profil")}</Button>
                            </div>

                            <GradingPeriodsEditor />

                            {canManageWhatsapp && <WhatsappAutoCard />}
                        </div>
                    )}

                    {/* Users Tab */}
                    {activeTab === 'users' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">{tr("Gestion des Utilisateurs")}</h2>
                                <p className="text-gray-600">{tr("Modifier les identifiants de l'administrateur et de la secrétaire")}</p>
                            </div>

                            {/* Admin Section */}
                            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <Users className="text-blue-600" size={20} />
                                    </div>{tr("Compte Administrateur")}</h3>
                                {adminUser ? (
                                    <div className="space-y-4">
                                        {/* Avatar Upload Section */}
                                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                                            <h4 className="text-sm font-bold text-gray-700 mb-3">{tr("Photo de profil")}</h4>
                                            <div className="flex items-center gap-4">
                                                {/* Avatar Preview */}
                                                <div className="w-24 h-24 rounded-full border-2 border-blue-300 overflow-hidden bg-gray-100 flex items-center justify-center">
                                                    {adminUser.avatar ? (
                                                        <img
                                                            src={adminUser.avatar}
                                                            alt={tr("Admin Avatar")}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Users className="text-gray-400" size={40} />
                                                    )}
                                                </div>
                                                {/* Upload Button */}
                                                <div className="flex-1">
                                                    <label className="cursor-pointer">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        setAdminUser({ ...adminUser, avatar: reader.result as string });
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />
                                                        <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors inline-block">{tr("Changer la photo")}</div>
                                                    </label>
                                                    {adminUser.avatar && (
                                                        <button
                                                            onClick={() => setAdminUser({ ...adminUser, avatar: '' })}
                                                            className="ms-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-semibold transition-colors"
                                                        >{tr("Supprimer")}</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label={tr("Nom complet")}
                                                value={adminUser.name}
                                                onChange={(e) => setAdminUser({ ...adminUser, name: e.target.value })}
                                                className="bg-white"
                                            />
                                            <Input
                                                label={tr("Email (Login)")}
                                                type="email"
                                                value={adminUser.email}
                                                onChange={(e) => setAdminUser({ ...adminUser, email: e.target.value })}
                                                className="bg-white"
                                            />
                                            <Input
                                                label={tr("GSM (Téléphone)")}
                                                value={adminUser.gsm || ''}
                                                onChange={(e) => setAdminUser({ ...adminUser, gsm: e.target.value })}
                                                placeholder={tr("+212 XXX-XXXXXX")}
                                                className="bg-white"
                                            />
                                            <Input
                                                label={tr("WhatsApp")}
                                                value={adminUser.whatsapp || ''}
                                                onChange={(e) => setAdminUser({ ...adminUser, whatsapp: e.target.value })}
                                                placeholder={tr("+212 XXX-XXXXXX")}
                                                className="bg-white"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label={tr("Adresse")}
                                                value={adminUser.address || ''}
                                                onChange={(e) => setAdminUser({ ...adminUser, address: e.target.value })}
                                                placeholder={tr("Adresse complète")}
                                                className="bg-white"
                                            />
                                            <Input
                                                label={tr("Niveau scolaire")}
                                                value={adminUser.schoolLevel || ''}
                                                onChange={(e) => setAdminUser({ ...adminUser, schoolLevel: e.target.value })}
                                                placeholder={tr("Bac+5, Master, etc.")}
                                                className="bg-white"
                                            />
                                        </div>
                                        <Input
                                            label={tr("Certification / Diplôme")}
                                            value={adminUser.certification || ''}
                                            onChange={(e) => setAdminUser({ ...adminUser, certification: e.target.value })}
                                            placeholder={tr("Diplômes et certifications")}
                                            className="bg-white"
                                        />
                                        <div className="relative">
                                            <Input
                                                label={tr("Nouveau mot de passe (laisser vide pour ne pas changer)")}
                                                type={showAdminPassword ? "text" : "password"}
                                                value={adminPassword}
                                                onChange={(e) => setAdminPassword(e.target.value)}
                                                placeholder={tr("Entrez un nouveau mot de passe")}
                                                className="bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAdminPassword(!showAdminPassword)}
                                                className="absolute end-3 top-[38px] text-gray-500 hover:text-gray-700"
                                            >
                                                {showAdminPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <Button
                                                onClick={() => handleUpdateUser(adminUser, adminPassword)}
                                                isLoading={saving}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 font-semibold"
                                            >{tr("💾 Mettre à jour Admin")}</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">{tr("Aucun compte administrateur trouvé.")}</p>
                                )}
                            </div>

                            {/* Secretary Section */}
                            <div className="bg-purple-50 rounded-xl p-4 sm:p-6 border border-purple-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <div className="bg-purple-100 p-2 rounded-lg">
                                        <Users className="text-purple-600" size={20} />
                                    </div>{tr("Compte Secrétaire")}</h3>
                                {secretaryUser ? (
                                    <div className="space-y-4">
                                        {/* Avatar Upload Section */}
                                        <div className="bg-white rounded-lg p-4 border border-purple-200">
                                            <h4 className="text-sm font-bold text-gray-700 mb-3">{tr("Photo de profil")}</h4>
                                            <div className="flex items-center gap-4">
                                                {/* Avatar Preview */}
                                                <div className="w-24 h-24 rounded-full border-2 border-purple-300 overflow-hidden bg-gray-100 flex items-center justify-center">
                                                    {secretaryUser.avatar ? (
                                                        <img
                                                            src={secretaryUser.avatar}
                                                            alt={tr("Secretary Avatar")}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Users className="text-gray-400" size={40} />
                                                    )}
                                                </div>
                                                {/* Upload Button */}
                                                <div className="flex-1">
                                                    <label className="cursor-pointer">
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) {
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => {
                                                                        setSecretaryUser({ ...secretaryUser, avatar: reader.result as string });
                                                                    };
                                                                    reader.readAsDataURL(file);
                                                                }
                                                            }}
                                                        />
                                                        <div className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors inline-block">{tr("Changer la photo")}</div>
                                                    </label>
                                                    {secretaryUser.avatar && (
                                                        <button
                                                            onClick={() => setSecretaryUser({ ...secretaryUser, avatar: '' })}
                                                            className="ms-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg font-semibold transition-colors"
                                                        >{tr("Supprimer")}</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label={tr("Nom complet")}
                                                value={secretaryUser.name}
                                                onChange={(e) => setSecretaryUser({ ...secretaryUser, name: e.target.value })}
                                                className="bg-white"
                                            />
                                            <Input
                                                label={tr("Email (Login)")}
                                                type="email"
                                                value={secretaryUser.email}
                                                onChange={(e) => setSecretaryUser({ ...secretaryUser, email: e.target.value })}
                                                className="bg-white"
                                            />
                                            <Input
                                                label={tr("GSM (Téléphone)")}
                                                value={secretaryUser.gsm || ''}
                                                onChange={(e) => setSecretaryUser({ ...secretaryUser, gsm: e.target.value })}
                                                placeholder={tr("+212 XXX-XXXXXX")}
                                                className="bg-white"
                                            />
                                            <Input
                                                label={tr("WhatsApp")}
                                                value={secretaryUser.whatsapp || ''}
                                                onChange={(e) => setSecretaryUser({ ...secretaryUser, whatsapp: e.target.value })}
                                                placeholder={tr("+212 XXX-XXXXXX")}
                                                className="bg-white"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                label={tr("Adresse")}
                                                value={secretaryUser.address || ''}
                                                onChange={(e) => setSecretaryUser({ ...secretaryUser, address: e.target.value })}
                                                placeholder={tr("Adresse complète")}
                                                className="bg-white"
                                            />
                                            <Input
                                                label={tr("Niveau scolaire")}
                                                value={secretaryUser.schoolLevel || ''}
                                                onChange={(e) => setSecretaryUser({ ...secretaryUser, schoolLevel: e.target.value })}
                                                placeholder={tr("Bac+5, Master, etc.")}
                                                className="bg-white"
                                            />
                                        </div>
                                        <Input
                                            label={tr("Certification / Diplôme")}
                                            value={secretaryUser.certification || ''}
                                            onChange={(e) => setSecretaryUser({ ...secretaryUser, certification: e.target.value })}
                                            placeholder={tr("Diplômes et certifications")}
                                            className="bg-white"
                                        />
                                        <div className="relative">
                                            <Input
                                                label={tr("Nouveau mot de passe (laisser vide pour ne pas changer)")}
                                                type={showSecretaryPassword ? "text" : "password"}
                                                value={secretaryPassword}
                                                onChange={(e) => setSecretaryPassword(e.target.value)}
                                                placeholder={tr("Entrez un nouveau mot de passe")}
                                                className="bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecretaryPassword(!showSecretaryPassword)}
                                                className="absolute end-3 top-[38px] text-gray-500 hover:text-gray-700"
                                            >
                                                {showSecretaryPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <Button
                                                onClick={() => handleUpdateUser(secretaryUser, secretaryPassword)}
                                                isLoading={saving}
                                                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 font-semibold"
                                            >{tr("💾 Mettre à jour Secrétaire")}</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">{tr("Aucun compte secrétaire trouvé.")}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Theme Tab */}
                    {activeTab === 'theme' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">{tr("Apparence de l'Application")}</h2>
                                <p className="text-gray-600">{tr("Personnaliser le thème et les couleurs")}</p>
                            </div>

                            {/* Theme Mode */}
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-3 block">{tr("Mode d'affichage")}</label>
                                <div className="grid grid-cols-3 gap-4">
                                    {[
                                        { value: 'light', label: 'Clair', icon: Sun },
                                        { value: 'dark', label: 'Sombre', icon: Moon },
                                        { value: 'auto', label: 'Auto', icon: Monitor },
                                    ].map((option) => {
                                        const Icon = option.icon;
                                        return (
                                            <button
                                                key={option.value}
                                                onClick={() => setTheme(option.value as any)}
                                                className={`p-6 rounded-xl border-2 transition-all ${theme === option.value
                                                    ? 'border-blue-600 bg-blue-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <Icon className={`mx-auto mb-2 ${theme === option.value ? 'text-blue-600' : 'text-gray-400'}`} size={32} />
                                                <p className={`font-semibold ${theme === option.value ? 'text-blue-600' : 'text-gray-700'}`}>
                                                    {tr(option.label)}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Accent Color */}
                            <div>
                                <label className="text-sm font-semibold text-gray-700 mb-3 block">{tr("Couleur d'accent")}</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="color"
                                        value={accentColor}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        className="w-20 h-20 rounded-xl border-2 border-gray-200 cursor-pointer"
                                    />
                                    <div>
                                        <p className="text-sm text-gray-600">{tr("Couleur sélectionnée")}</p>
                                        <p className="font-mono font-bold text-gray-800">{accentColor}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button
                                    onClick={handleSaveTheme}
                                    isLoading={saving}
                                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl font-bold"
                                >
                                    <Save size={20} />{tr("Enregistrer le thème")}</Button>
                            </div>
                        </div>
                    )}

                    {/* Backup Tab */}
                    {activeTab === 'backup' && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">{tr("Sauvegarde et Restauration")}</h2>
                                <p className="text-gray-600">{tr("Gérer les sauvegardes de la base de données")}</p>
                            </div>

                            {/* Backup Section */}
                            <div className="bg-blue-50 rounded-xl p-4 sm:p-6 border border-blue-200">
                                <div className="flex items-start gap-4">
                                    <div className="bg-blue-100 p-3 rounded-lg">
                                        <Download className="text-blue-600" size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-800 mb-2">{tr("Créer une sauvegarde")}</h3>
                                        <p className="text-sm text-gray-600 mb-4">{tr("Télécharger une copie complète de la base de données. Cette sauvegarde inclut tous les étudiants, inscriptions, paiements et utilisateurs.")}</p>
                                        <Button
                                            onClick={handleBackup}
                                            isLoading={saving}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                                        >
                                            <Download size={18} />{tr("Télécharger la sauvegarde")}</Button>
                                    </div>
                                </div>
                            </div>

                            {/* Restore Section */}
                            <div className="bg-orange-50 rounded-xl p-4 sm:p-6 border border-orange-200">
                                <div className="flex items-start gap-4">
                                    <div className="bg-orange-100 p-3 rounded-lg">
                                        <Upload className="text-orange-600" size={24} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-800 mb-2">{tr("Restaurer une sauvegarde")}</h3>
                                        <p className="text-sm text-gray-600 mb-4">{tr("Restaurer la base de données à partir d'un fichier de sauvegarde.")}<strong className="text-orange-700">{tr("Attention:")}</strong>{tr("Cette action remplacera toutes les données actuelles.")}</p>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="file"
                                                accept=".sql,.backup"
                                                className="block w-full text-sm text-gray-600 file:me-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200 cursor-pointer"
                                            />
                                            <Button
                                                onClick={handleRestore}
                                                isLoading={saving}
                                                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-semibold whitespace-nowrap"
                                            >
                                                <Upload size={18} />{tr("Restaurer")}</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Warning */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
                                <div className="text-sm text-yellow-800">
                                    <p className="font-semibold mb-1">{tr("Important")}</p>
                                    <p>{tr("Assurez-vous de créer des sauvegardes régulières de vos données. Il est recommandé de faire une sauvegarde avant toute modification importante du système.")}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
