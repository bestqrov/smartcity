'use client';

import { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Edit,
    Trash2,
    Shield,
    Mail,
    Lock,
    Search,
    UserCog,
    X,
    Check
} from 'lucide-react';
import { getAllUsers, createUser, updateUser, deleteUser } from '@/lib/services/users';
import { User, UserRole } from '@/types';
import Button from '@/components/Button';
import Input from '@/components/Input';

export default function UsersCRUD() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const initialFormData = {
        name: '',
        email: '',
        password: '',
        role: 'SECRETARY' as UserRole
    };
    const [formData, setFormData] = useState(initialFormData);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await getAllUsers();
            setUsers(data);
        } catch (err) {
            console.error('Failed to fetch users', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (user: User | null) => {
        setEditingUser(user);
        if (user) {
            setFormData({
                name: user.name,
                email: user.email,
                password: '',
                role: user.role
            });
        } else {
            setFormData(initialFormData);
        }
        setIsModalOpen(true);
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            if (editingUser) {
                const updateData: any = { ...formData };
                if (!updateData.password) delete updateData.password;
                await updateUser(editingUser.id, updateData);
                setSuccess('Utilisateur mis à jour avec succès');
            } else {
                if (!formData.password) {
                    setError('Le mot de passe est requis pour un nouvel utilisateur');
                    return;
                }
                await createUser(formData);
                setSuccess('Utilisateur créé avec succès');
            }
            fetchUsers();
            setTimeout(() => setIsModalOpen(false), 1500);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Une erreur est survenue');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
            try {
                await deleteUser(id);
                fetchUsers();
            } catch (err) {
                console.error(err);
            }
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <UserCog className="text-blue-600" size={32} />
                        Gestion des Utilisateurs
                    </h1>
                    <p className="text-gray-600 mt-1">Gérer les administrateurs et les secrétaires du système</p>
                </div>
                <Button
                    onClick={() => handleOpenModal(null)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2"
                >
                    <UserPlus size={20} />
                    Nouvel Utilisateur
                </Button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Rechercher par nom ou email..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">Utilisateur</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider">Rôle</th>
                            <th className="px-6 py-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        Chargement des utilisateurs...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                    Aucun utilisateur trouvé
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-sm ${user.role === 'ADMIN' ? 'bg-gradient-to-br from-indigo-500 to-blue-600' : 'bg-gradient-to-br from-purple-500 to-pink-600'
                                                }`}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{user.name}</p>
                                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Mail size={12} />
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${user.role === 'ADMIN'
                                                ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                                : 'bg-purple-50 text-purple-600 border border-purple-100'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(user)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Modifier"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Supprimer"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                {editingUser ? <Edit className="text-blue-600" size={20} /> : <UserPlus className="text-blue-600" size={20} />}
                                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel Utilisateur'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-2">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm font-medium border border-green-100 flex items-center gap-2">
                                    <Check size={18} />
                                    {success}
                                </div>
                            )}

                            <Input
                                label="Nom complet"
                                placeholder="Ex: Jean Dupont"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />

                            <Input
                                label="Email (Identifiant)"
                                type="email"
                                placeholder="email@exemple.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-700">Rôle</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'SECRETARY' })}
                                        className={`py-3 rounded-xl border-2 font-bold transition-all ${formData.role === 'SECRETARY'
                                                ? 'border-purple-600 bg-purple-50 text-purple-700'
                                                : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                                            }`}
                                    >
                                        Secrétaire
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                                        className={`py-3 rounded-xl border-2 font-bold transition-all ${formData.role === 'ADMIN'
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                                : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                                            }`}
                                    >
                                        Administrateur
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-gray-700 flex items-center justify-between">
                                    Mot de passe
                                    {editingUser && <span className="text-[10px] text-gray-400 font-normal italic">(Laissez vide pour conserver)</span>}
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20">
                                    {editingUser ? 'Mettre à jour' : 'Créer l\'utilisateur'}
                                </Button>
                                <Button type="button" onClick={() => setIsModalOpen(false)} className="bg-gray-100 text-gray-600 px-6">
                                    Annuler
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
