'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal'; // Ensure this path is correct
import { groupsService } from '@/lib/services/groups';
import { Button } from '@/components/ui/Button';

interface StudentGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: any;
}

export default function StudentGroupModal({ isOpen, onClose, student }: StudentGroupModalProps) {
    const [groups, setGroups] = useState<any[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadGroups();
        }
    }, [isOpen]);

    const loadGroups = async () => {
        try {
            const data = await groupsService.getAll();
            setGroups(data);
        } catch (error) {
            console.error("Failed to load groups", error);
        }
    };

    const handleAssign = async () => {
        if (!selectedGroupId || !student) return;
        setLoading(true);
        try {
            // Find current group and add student
            // This logic depends on your API. 
            // Often you update the student with a groupId, OR update the group with studentId.
            // Based on previous code, it seemed to update the group.

            // Assuming we update the group to include this student:
            const group = groups.find(g => g.id === selectedGroupId);
            if (group) {
                const currentIds = group.studentIds || group.students?.map((s: any) => s.id) || [];
                if (!currentIds.includes(student.id)) {
                    await groupsService.update(selectedGroupId, {
                        studentIds: [...currentIds, student.id]
                    });
                }
            }

            onClose();
            alert('Étudiant ajouté au groupe avec succès');
        } catch (error) {
            console.error('Failed to assign group', error);
            alert('Erreur lors de l\'assignation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Assigner au Groupe</h3>
                    <p className="text-gray-500 text-sm mb-6">
                        Sélectionnez un groupe pour <span className="font-semibold text-gray-800">{student?.name}</span>
                    </p>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Groupe</label>
                            <select
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">-- Sélectionner --</option>
                                {groups.map(group => (
                                    <option key={group.id} value={group.id}>
                                        {group.name} ({group.subject})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleAssign}
                            disabled={!selectedGroupId || loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                        >
                            {loading ? 'Assignation...' : 'Confirmer'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
