'use client';

import { useState, useEffect } from 'react';
import { Calendar, Printer, Save, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

import { getStudents } from '@/lib/services/students';
import { groupsService } from '@/lib/services/groups';

interface Student {
    id: string;
    name: string;
    surname: string;
}

interface Group {
    id: string;
    name: string;
    subject: string;
    niveau: string;
    teacherName?: string;
    room?: string;
    studentIds: string[];
}

type WeekKey = 'week1' | 'week2' | 'week3' | 'week4' | 'week5';

interface MonthlyAttendance {
    groupId: string;
    month: string;
    year: string;
    attendance: {
        [studentId: string]: {
            week1: { s1: boolean; s2: boolean };
            week2: { s1: boolean; s2: boolean };
            week3: { s1: boolean; s2: boolean };
            week4: { s1: boolean; s2: boolean };
            week5: { s1: boolean; s2: boolean };
            observation: string;
        };
    };
}

export default function PresencePage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
    const [attendance, setAttendance] = useState<MonthlyAttendance['attendance']>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (selectedGroup) {
            loadAttendance(selectedGroup.id, selectedMonth);
        }
    }, [selectedGroup, selectedMonth]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Load groups from API
            const groupsData = await groupsService.getAll('SOUTIEN'); // Default to SOUTIEN for now or fetch all

            // Map backend data to frontend interface
            const mappedGroups: Group[] = groupsData.map((g: any) => ({
                id: g.id,
                name: g.name,
                subject: g.subject,
                niveau: g.level, // Map level to niveau
                teacherName: g.teacher ? `${g.teacher.name} ${g.teacher.surname || ''}`.trim() : undefined,
                room: g.room,
                studentIds: g.students ? g.students.map((s: any) => s.id) : []
            }));

            setGroups(mappedGroups);

            // Load students from API
            const studentsData = await getStudents();
            setStudents(studentsData);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAttendance = (groupId: string, month: string) => {
        const [year, monthNum] = month.split('-');
        const storedAttendance = localStorage.getItem('monthly-attendance');

        if (storedAttendance) {
            const records: MonthlyAttendance[] = JSON.parse(storedAttendance);
            const record = records.find(r => r.groupId === groupId && r.month === monthNum && r.year === year);

            if (record) {
                setAttendance(record.attendance);
            } else {
                initializeAttendance();
            }
        } else {
            initializeAttendance();
        }
    };

    const initializeAttendance = () => {
        if (!selectedGroup) return;

        const newAttendance: MonthlyAttendance['attendance'] = {};
        const groupStudents = students.filter(s => selectedGroup.studentIds.includes(s.id));

        groupStudents.forEach(student => {
            newAttendance[student.id] = {
                week1: { s1: false, s2: false },
                week2: { s1: false, s2: false },
                week3: { s1: false, s2: false },
                week4: { s1: false, s2: false },
                week5: { s1: false, s2: false },
                observation: ''
            };
        });

        setAttendance(newAttendance);
    };

    const toggleAttendance = (studentId: string, week: WeekKey, session: 's1' | 's2') => {
        setAttendance(prev => {
            const studentEntry = prev[studentId];
            if (!studentEntry) return prev;

            return {
                ...prev,
                [studentId]: {
                    ...studentEntry,
                    [week]: {
                        ...studentEntry[week],
                        [session]: !studentEntry[week][session]
                    }
                }
            };
        });
    };

    const updateObservation = (studentId: string, observation: string) => {
        setAttendance(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                observation
            }
        }));
    };

    const saveAttendance = () => {
        if (!selectedGroup) return;

        const [year, month] = selectedMonth.split('-');
        const storedAttendance = localStorage.getItem('monthly-attendance');
        let records: MonthlyAttendance[] = storedAttendance ? JSON.parse(storedAttendance) : [];

        records = records.filter(r => !(r.groupId === selectedGroup.id && r.month === month && r.year === year));

        records.push({
            groupId: selectedGroup.id,
            month,
            year,
            attendance
        });

        localStorage.setItem('monthly-attendance', JSON.stringify(records));
        alert('Présence enregistrée avec succès!');
    };

    const handlePrint = () => {
        window.print();
    };

    const groupStudents = selectedGroup
        ? students.filter(s => selectedGroup.studentIds.includes(s.id))
        : [];

    const monthName = new Date(selectedMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    return (
        <div className="p-6 space-y-6">
            {/* Header - Hide on print */}
            <div className="flex justify-between items-center print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">L'Absence de Mois</h1>
                    <p className="text-gray-500">Gestion de présence mensuelle par groupe</p>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                    {selectedGroup && (
                        <>
                            <Button onClick={saveAttendance} className="bg-green-600 hover:bg-green-700 text-white">
                                <Save size={18} className="mr-2" /> Enregistrer
                            </Button>
                            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Printer size={18} className="mr-2" /> Imprimer
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Group Selection - Hide on print */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 print:hidden">
                <label className="block text-sm font-medium text-gray-700 mb-2">Sélectionner un groupe</label>
                <select
                    value={selectedGroup?.id || ''}
                    onChange={(e) => {
                        const group = groups.find(g => g.id === e.target.value);
                        setSelectedGroup(group || null);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                >
                    <option value="">-- Choisir un groupe --</option>
                    {groups.map(group => (
                        <option key={group.id} value={group.id}>
                            {group.name} - {group.subject} ({group.niveau})
                        </option>
                    ))}
                </select>
            </div>

            {/* Attendance Sheet */}
            {selectedGroup ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-0">
                    {/* Form Header */}
                    <div className="p-6 border-b border-gray-200 print:p-4">
                        <h2 className="text-2xl font-bold text-center mb-6 print:text-xl">GESTION DE PRESENCE</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm print:text-xs">
                            <div className="flex gap-2">
                                <span className="font-semibold">MOIS:</span>
                                <span className="border-b border-dotted border-gray-400 flex-1">{monthName}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold">PROFESSEUR:</span>
                                <span className="border-b border-dotted border-gray-400 flex-1">{selectedGroup.teacherName || '.....................'}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold">MATIERE:</span>
                                <span className="border-b border-dotted border-gray-400 flex-1">{selectedGroup.subject}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="font-semibold">SALLE:</span>
                                <span className="border-b border-dotted border-gray-400 flex-1">{selectedGroup.room || '.....................'}</span>
                            </div>
                            <div className="flex gap-2 col-span-2">
                                <span className="font-semibold">GROUPE:</span>
                                <span className="border-b border-dotted border-gray-400 flex-1">{selectedGroup.name}</span>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm print:text-xs">
                            <thead>
                                <tr className="border-b-2 border-gray-300">
                                    <th className="border border-gray-300 px-4 py-2 bg-gray-50 font-bold text-left sticky left-0 z-10 print:px-2 print:py-1">
                                        NOMS
                                    </th>
                                    {['SEMAINE1', 'SEMAINE2', 'SEMAINE3', 'SEMAINE4', 'SEMAINE5'].map((week, idx) => (
                                        <th key={week} colSpan={2} className="border border-gray-300 px-2 py-2 bg-gray-50 font-bold text-center print:px-1 print:py-1">
                                            {week}
                                        </th>
                                    ))}
                                    <th className="border border-gray-300 px-4 py-2 bg-gray-50 font-bold text-center print:px-2 print:py-1">
                                        OBSERVATION
                                    </th>
                                </tr>
                                <tr className="border-b border-gray-300">
                                    <th className="border border-gray-300 px-4 py-2 bg-gray-50 sticky left-0 z-10"></th>
                                    {[1, 2, 3, 4, 5].map(week => (
                                        <>
                                            <th key={`${week}-s1`} className="border border-gray-300 px-2 py-1 bg-gray-50 text-center text-xs print:px-1">S1</th>
                                            <th key={`${week}-s2`} className="border border-gray-300 px-2 py-1 bg-gray-50 text-center text-xs print:px-1">S2</th>
                                        </>
                                    ))}
                                    <th className="border border-gray-300 px-2 py-1 bg-gray-50"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupStudents.map((student, idx) => (
                                    <tr key={student.id} className="hover:bg-gray-50">
                                        <td className="border border-gray-300 px-4 py-2 font-medium sticky left-0 bg-white z-10 print:px-2 print:py-1">
                                            {idx + 1}. {student.name} {student.surname}
                                        </td>
                                        {(['week1', 'week2', 'week3', 'week4', 'week5'] as const).map(week => (
                                            <>
                                                <td key={`${week}-s1`} className="border border-gray-300 p-0 text-center">
                                                    <button
                                                        onClick={() => toggleAttendance(student.id, week, 's1')}
                                                        className={`w-full h-full px-2 py-3 print:py-2 transition-colors ${attendance[student.id]?.[week]?.s1
                                                            ? 'bg-green-100 hover:bg-green-200'
                                                            : 'bg-red-50 hover:bg-red-100'
                                                            }`}
                                                    >
                                                        {attendance[student.id]?.[week]?.s1 ? '✓' : '✗'}
                                                    </button>
                                                </td>
                                                <td key={`${week}-s2`} className="border border-gray-300 p-0 text-center">
                                                    <button
                                                        onClick={() => toggleAttendance(student.id, week, 's2')}
                                                        className={`w-full h-full px-2 py-3 print:py-2 transition-colors ${attendance[student.id]?.[week]?.s2
                                                            ? 'bg-green-100 hover:bg-green-200'
                                                            : 'bg-red-50 hover:bg-red-100'
                                                            }`}
                                                    >
                                                        {attendance[student.id]?.[week]?.s2 ? '✓' : '✗'}
                                                    </button>
                                                </td>
                                            </>
                                        ))}
                                        <td className="border border-gray-300 p-1">
                                            <input
                                                type="text"
                                                value={attendance[student.id]?.observation || ''}
                                                onChange={(e) => updateObservation(student.id, e.target.value)}
                                                className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-blue-500 rounded print:text-xs"
                                                placeholder="..."
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {groupStudents.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                                            Aucun étudiant dans ce groupe
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center print:hidden">
                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Sélectionnez un groupe</h3>
                    <p className="text-gray-500 mt-2">
                        Choisissez un groupe pour gérer la présence mensuelle
                    </p>
                </div>
            )}

            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                    }
                    .print\\:hidden {
                        display: none !important;
                    }
                    table {
                        page-break-inside: avoid;
                    }
                }
            `}</style>
        </div>
    );
}
