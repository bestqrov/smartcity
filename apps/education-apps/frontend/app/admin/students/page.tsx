'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    FileText,
    Download,
    Trash2,
    Users,
    GraduationCap,
    BookOpen,
    Edit,
    Phone,
    Mail,
    User as UserIcon,
    Shield,
    Calendar,
    ArrowRight
} from 'lucide-react';
import { getStudents, deleteStudent } from '@/lib/services/students';
import { groupsService } from '@/lib/services/groups'; // Adjust path if needed
import AddStudentForm from '@/components/forms/AddStudentForm'; // Adjust path
import StudentGroupModal from '@/components/StudentGroupModal'; // Adjust path

export default function StudentsPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState('ALL');
    const [showFilters, setShowFilters] = useState(false);

    // View Switching State
    const [isAddMode, setIsAddMode] = useState(false); // Replaces isModalOpen
    const [editingStudent, setEditingStudent] = useState<any | null>(null);

    // Group Modal State (Keeping as modal for now)
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [selectedStudentForGroup, setSelectedStudentForGroup] = useState<any>(null);

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

    const handleDelete = async (id: string) => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cet élève ?')) {
            try {
                await deleteStudent(id);
                fetchStudents();
            } catch (error) {
                console.error('Failed to delete student:', error);
            }
        }
    };

    const handleEdit = (student: any) => {
        setEditingStudent(student);
        setIsAddMode(true);
    };

    const handleOpenGroupModal = (student: any) => {
        setSelectedStudentForGroup(student);
        setIsGroupModalOpen(true);
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
            student.phone?.includes(searchQuery); // Phone might be number or string
        const matchesLevel = filterLevel === 'ALL' || student.level === filterLevel;
        return matchesSearch && matchesLevel;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Context Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {isAddMode
                            ? (editingStudent ? 'Modifier l\'Élève' : 'Nouvel Élève')
                            : 'Gestion des Élèves'
                        }
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        {isAddMode
                            ? 'Remplissez les informations ci-dessous'
                            : 'Gérez les inscriptions et les dossiers scolaires'
                        }
                    </p>
                </div>

                {!isAddMode && (
                    <div className="flex gap-3">
                        <button className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 bg-white shadow-sm">
                            <Download size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Statistics Row */}
            {!isAddMode && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Élèves</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{students.length}</p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Shield size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Élèves Actifs</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">
                                {students.filter(s => s.active).length}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <GraduationCap size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Niveaux Gérés</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">3</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">

                {/* LIST VIEW */}
                {!isAddMode && (
                    <>
                        {/* Filters Bar */}
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Rechercher par nom, email, téléphone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div className="flex gap-3">
                                <select
                                    value={filterLevel}
                                    onChange={(e) => setFilterLevel(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                                >
                                    <option value="ALL">Tous les niveaux</option>
                                    <option value="PRIMAIRE">Primaire</option>
                                    <option value="COLLEGE">Collège</option>
                                    <option value="LYCEE">Lycée</option>
                                </select>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`p-2 rounded-xl transition-colors ${showFilters ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                                >
                                    <Filter size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 font-bold text-xs uppercase tracking-wider">
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
                                        <th className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Shield size={14} /> Statut
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                                <div className="flex justify-center items-center gap-3">
                                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                    Chargement des données...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredStudents.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                                <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                                    <Search size={32} className="opacity-50" />
                                                </div>
                                                <p className="font-medium">Aucun élève trouvé</p>
                                                <p className="text-sm mt-1">Essayez de modifier vos filtres de recherche</p>
                                            </td>
                                        </tr>
                                    ) : filteredStudents.map((student) => (
                                        <tr key={student.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-700/30 transition-all duration-200 group border-b border-slate-50 dark:border-slate-700/50">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
                                                            {student.name?.charAt(0).toUpperCase() || '?'}
                                                        </div>
                                                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${student.active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                                                            {student.name || (
                                                                <button onClick={() => handleEdit(student)} className="text-slate-400 font-normal italic hover:text-blue-500 transition-colors">Non renseigné</button>
                                                            )} {student.surname}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                                                            <Mail size={12} className="text-slate-400" />
                                                            {student.email || (
                                                                <button onClick={() => handleEdit(student)} className="text-slate-300 dark:text-slate-600 italic hover:text-blue-500 transition-colors">Pas d'email</button>
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
                                                    <span className={`inline-flex items-center px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border-2 shadow-sm ${student.schoolLevel === 'LYCEE' ? 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-indigo-100/50' :
                                                            student.schoolLevel === 'COLLEGE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-emerald-100/50' :
                                                                student.schoolLevel === 'PRIMAIRE' ? 'bg-amber-50 text-amber-700 border-amber-100 shadow-amber-100/50' :
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
                                                            <span className="text-slate-300 mx-1">|</span>
                                                            {(() => {
                                                                let total = 0;
                                                                Object.values(student.subjects).forEach((val: any) => {
                                                                    if (typeof val === 'number') total += val;
                                                                });
                                                                return <span className="text-indigo-600 font-black">{total} MAD/m</span>;
                                                            })()}
                                                        </span>
                                                    )}
                                                    {student.cin && (
                                                        <span className="text-[10px] text-slate-400 font-medium ml-1">CIN: {student.cin}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 inline-block min-w-[180px]">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                                                            <UserIcon size={12} className="text-blue-500" />
                                                        </div>
                                                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                                                            {student.parentName || (
                                                                <button onClick={() => handleEdit(student)} className="text-slate-400 font-normal italic hover:text-blue-500 transition-colors">Non renseigné</button>
                                                            )}
                                                        </span>
                                                        {student.parentRelation && (
                                                            <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-md text-blue-600 font-black uppercase">
                                                                {student.parentRelation}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Phone size={12} className="text-slate-400" />
                                                        <span className="font-medium">
                                                            {student.parentPhone || (
                                                                <button onClick={() => handleEdit(student)} className="text-slate-300 dark:text-slate-600 italic hover:text-blue-500 transition-colors">Pas de téléphone</button>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${student.active
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                    : 'bg-red-50 text-red-700 border border-red-100'
                                                    }`}>
                                                    <span className={`w-2 h-2 rounded-full animate-pulse ${student.active ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                    {student.active ? 'Actif' : 'Inactif'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <div className="flex justify-end gap-1.5 group-hover:translate-x-[-4px] transition-transform">
                                                    <button
                                                        onClick={() => handleOpenGroupModal(student)}
                                                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                                                        title="Assigner au groupe"
                                                    >
                                                        <ArrowRight size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEdit(student)}
                                                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
                                                        title="Modifier"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(student.id)}
                                                        className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* ADD/EDIT FORM VIEW (Replaces List View) */}
                {isAddMode && (
                    <div className="p-6 md:p-8 animate-in slide-in-from-right-4 duration-300">
                        <div className="max-w-4xl mx-auto">
                            <div className="mb-8 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                        {editingStudent ? 'Modification du dossier' : 'Formulaire d\'inscription'}
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        Saisissez les informations personnelles et académiques
                                    </p>
                                </div>
                                <button
                                    onClick={handleCloseAddView}
                                    className="text-sm text-slate-500 hover:text-slate-900 underline underline-offset-4"
                                >
                                    Annuler et retour
                                </button>
                            </div>

                            <AddStudentForm
                                onSuccess={handleStudentAdded}
                                initialData={editingStudent}
                            // Pass any other necessary props to AddStudentForm if needed
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Group Assignment Modal (Still a modal as it's a quick action) */}
            {isGroupModalOpen && (
                <StudentGroupModal
                    isOpen={isGroupModalOpen}
                    onClose={() => setIsGroupModalOpen(false)}
                    student={selectedStudentForGroup}
                />
            )}
        </div>
    );
}
