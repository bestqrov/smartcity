'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    Download,
    Users,
    GraduationCap,
    Edit,
    Phone,
    Mail,
    User as UserIcon,
    Shield,
    Calendar,
    ArrowRight,
    BookOpen
} from 'lucide-react';
import { getStudents } from '@/lib/services/students';
import AddStudentForm from '@/components/forms/AddStudentForm';

export default function SecretaryStudentsPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState('ALL');
    const [isAddMode, setIsAddMode] = useState(false);
    const [editingStudent, setEditingStudent] = useState<any | null>(null);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        setIsLoading(true);
        try {
            const data = await getStudents();
            setStudents(data);
        } catch (error) {
            console.error('Failed to fetch students:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (student: any) => {
        setEditingStudent(student);
        setIsAddMode(true);
    };

    const handleCloseAddView = () => {
        setIsAddMode(false);
        setEditingStudent(null);
    };

    const handleStudentAdded = () => {
        fetchStudents();
        handleCloseAddView();
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch =
            student.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.parentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            student.phone?.includes(searchQuery);
        const matchesLevel = filterLevel === 'ALL' || student.level === filterLevel;
        return matchesSearch && matchesLevel;
    });

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                        <GraduationCap className="text-blue-600" size={32} />
                        Gestion des Élèves
                    </h1>
                    <p className="text-slate-500 mt-1">Gérez les dossiers scolaires des étudiants</p>
                </div>

                {!isAddMode && (
                    <button
                        onClick={() => setIsAddMode(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 font-bold"
                    >
                        <Plus size={20} />
                        Nouvel Élève
                    </button>
                )}
            </div>

            {/* Statistics Row */}
            {!isAddMode && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Élèves</p>
                            <p className="text-2xl font-black text-slate-900">{students.length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Shield size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Élèves Actifs</p>
                            <p className="text-2xl font-black text-slate-900">
                                {students.filter(s => s.active).length}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <GraduationCap size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Niveaux Gérés</p>
                            <p className="text-2xl font-black text-slate-900">3</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {!isAddMode ? (
                    <>
                        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Rechercher par nom, email, téléphone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                />
                            </div>
                            <select
                                value={filterLevel}
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className="px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer font-medium"
                            >
                                <option value="ALL">Tous les niveaux</option>
                                <option value="PRIMAIRE">Primaire</option>
                                <option value="COLLEGE">Collège</option>
                                <option value="LYCEE">Lycée</option>
                            </select>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 flex items-center gap-2">
                                            <UserIcon size={14} /> Étudiant
                                        </th>
                                        <th className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <GraduationCap size={14} /> Niveau
                                            </div>
                                        </th>
                                        <th className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Users size={14} /> Tuteur & Contact
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                    Chargement...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                                Aucun élève trouvé
                                            </td>
                                        </tr>
                                    ) : filteredStudents.map((student) => (
                                        <tr key={student.id} className="hover:bg-blue-50/30 transition-all duration-200 group border-b border-slate-50">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
                                                            {student.name?.charAt(0).toUpperCase() || '?'}
                                                        </div>
                                                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${student.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 text-base leading-tight">
                                                            {student.name || (
                                                                <button onClick={() => handleEdit(student)} className="text-slate-400 font-normal italic hover:text-blue-500 transition-colors">Non renseigné</button>
                                                            )} {student.surname}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                                                            <Mail size={12} className="text-slate-400" />
                                                            {student.email || (
                                                                <button onClick={() => handleEdit(student)} className="text-slate-300 italic hover:text-blue-500 transition-colors">Pas d'email</button>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                                                            <Calendar size={10} />
                                                            Inscrit le {new Date(student.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1.5">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide border ${student.schoolLevel === 'LYCEE' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                                        student.schoolLevel === 'COLLEGE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            student.schoolLevel === 'PRIMAIRE' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                                'bg-slate-50 text-slate-400 border-slate-100 italic'
                                                        }`}>
                                                        {student.schoolLevel || (
                                                            <button onClick={() => handleEdit(student)} className="hover:text-blue-500 transition-colors">Non renseigné</button>
                                                        )}
                                                    </span>
                                                    {student.subjects && Object.keys(student.subjects).length > 0 && (
                                                        <span className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 ml-1 mt-1">
                                                            <BookOpen size={10} />
                                                            {Object.keys(student.subjects).length} Matière(s)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 inline-block min-w-[180px]">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center shadow-sm">
                                                            <UserIcon size={12} className="text-blue-500" />
                                                        </div>
                                                        <span className="font-bold text-slate-900 text-sm">
                                                            {student.parentName || (
                                                                <button onClick={() => handleEdit(student)} className="text-slate-400 font-normal italic hover:text-blue-500 transition-colors">Non renseigné</button>
                                                            )}
                                                        </span>
                                                        {student.parentRelation && (
                                                            <span className="text-[10px] bg-blue-100 px-1.5 py-0.5 rounded-md text-blue-600 font-black uppercase">
                                                                {student.parentRelation}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Phone size={12} className="text-slate-400" />
                                                        <span className="font-medium">
                                                            {student.parentPhone || (
                                                                <button onClick={() => handleEdit(student)} className="text-slate-300 italic hover:text-blue-500 transition-colors">Pas de téléphone</button>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <button
                                                    onClick={() => handleEdit(student)}
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                >
                                                    <Edit size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="p-8 max-w-4xl mx-auto">
                        <div className="mb-8 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {editingStudent ? 'Modifier le dossier' : 'Nouvel Élève'}
                                </h2>
                                <p className="text-sm text-slate-500">Saisissez les informations de l'étudiant</p>
                            </div>
                            <button
                                onClick={handleCloseAddView}
                                className="text-sm font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4"
                            >
                                Retour à la liste
                            </button>
                        </div>
                        <AddStudentForm
                            onSuccess={handleStudentAdded}
                            initialData={editingStudent}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
