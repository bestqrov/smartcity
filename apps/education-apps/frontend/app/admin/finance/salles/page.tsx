'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/Button';
import {
    PlusCircle,
    Edit,
    Trash2,
    Search,
    Building,
    Users,
    School as SchoolIcon,
    FlaskConical,
    Library as LibraryIcon,
    Video,
    DoorOpen,
    Bell,
    Cpu,
    Check,
    Wrench,
    Activity,
    Filter,
    LayoutGrid,
    List as ListIcon,
    MoreVertical
} from 'lucide-react';

// --- Types ---
interface Room {
    id: string;
    name: string;
    capacity: number;
    type: 'Classroom' | 'Lab' | 'Library' | 'Auditorium';
    status: 'active' | 'maintenance';
    equipments: string[];
}

// --- Constants & Mock Data ---
const TRAINING_ROOM_EQUIPMENT: Record<string, string[]> = {
    'furniture': ['desks', 'chairs', 'whiteboard', 'podium'],
    'technology': ['projector', 'computer', 'sound_system', 'wifi'],
    'safety': ['fire_extinguisher', 'first_aid_kit'],
    'climate': ['air_conditioning', 'heating']
};

const DEFAULT_ROOMS: Room[] = [
    { id: '1', name: 'Salle 101', capacity: 30, type: 'Classroom', status: 'active', equipments: ['desks', 'chairs', 'whiteboard'] },
    { id: '2', name: 'Labo Info', capacity: 20, type: 'Lab', status: 'active', equipments: ['computer', 'projector', 'wifi', 'air_conditioning'] },
    { id: '3', name: 'Bibliothèque', capacity: 50, type: 'Library', status: 'active', equipments: ['chairs', 'wifi', 'air_conditioning'] },
    { id: '4', name: 'Amphi A', capacity: 150, type: 'Auditorium', status: 'maintenance', equipments: ['projector', 'sound_system', 'wifi', 'air_conditioning'] },
];

// --- Components ---

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; trend?: string }> = ({ title, value, icon, color, trend }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
                {trend && <p className="text-xs text-green-600 mt-2 font-medium">{trend}</p>}
            </div>
            <div className={`p-3 rounded-xl ${color} text-white shadow-lg shadow-opacity-20`}>
                {icon}
            </div>
        </div>
    </div>
);

const RoomTypeIcon: React.FC<{ type: Room['type'], className?: string }> = ({ type, className = "w-6 h-6" }) => {
    switch (type) {
        case 'Classroom': return <SchoolIcon className={className} />;
        case 'Lab': return <FlaskConical className={className} />;
        case 'Library': return <LibraryIcon className={className} />;
        case 'Auditorium': return <Video className={className} />;
        default: return <DoorOpen className={className} />;
    }
};

export default function ManageRoomsPage() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('All');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    const initialFormData = {
        name: '',
        capacity: '' as unknown as number,
        type: 'Classroom' as Room['type'],
        status: 'active' as Room['status'],
        equipments: [] as string[],
    };
    const [formData, setFormData] = useState<Partial<Room>>(initialFormData);

    useEffect(() => {
        const storedRooms = localStorage.getItem('rooms');
        if (storedRooms) {
            setRooms(JSON.parse(storedRooms));
        } else {
            setRooms(DEFAULT_ROOMS);
            localStorage.setItem('rooms', JSON.stringify(DEFAULT_ROOMS));
        }
    }, []);

    const saveRooms = (newRooms: Room[]) => {
        setRooms(newRooms);
        localStorage.setItem('rooms', JSON.stringify(newRooms));
    };

    const openModalForEdit = (room: Room) => {
        setEditingRoom(room);
        setFormData(room);
        setIsModalOpen(true);
    };

    const openModalForNew = () => {
        setEditingRoom(null);
        setFormData(initialFormData);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingRoom(null);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEquipmentChange = (equipmentKey: string) => {
        const currentEquipments = formData.equipments || [];
        const newEquipments = currentEquipments.includes(equipmentKey)
            ? currentEquipments.filter(key => key !== equipmentKey)
            : [...currentEquipments, equipmentKey];
        setFormData(prev => ({ ...prev, equipments: newEquipments }));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const roomData: Room = {
            id: editingRoom ? editingRoom.id : Date.now().toString(),
            name: formData.name || '',
            capacity: Number(formData.capacity) || 0,
            type: formData.type || 'Classroom',
            status: formData.status || 'active',
            equipments: formData.equipments || [],
        };

        if (editingRoom) {
            saveRooms(rooms.map(r => r.id === editingRoom.id ? roomData : r));
        } else {
            saveRooms([...rooms, roomData]);
        }
        closeModal();
    };

    const handleDelete = (room: Room) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${room.name}?`)) {
            saveRooms(rooms.filter(r => r.id !== room.id));
        }
    };

    const toggleStatus = (room: Room) => {
        const newStatus = room.status === 'active' ? 'maintenance' : 'active';
        saveRooms(rooms.map(r => r.id === room.id ? { ...r, status: newStatus } : r));
    };

    const filteredRooms = useMemo(() => {
        return rooms.filter(room => {
            const typeMatch = activeTab === 'All' || room.type === activeTab;
            const searchMatch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                room.equipments.some(eq => eq.toLowerCase().includes(searchTerm.toLowerCase()));
            return typeMatch && searchMatch;
        });
    }, [rooms, activeTab, searchTerm]);

    const stats = useMemo(() => {
        return {
            total: rooms.length,
            capacity: rooms.reduce((acc, r) => acc + r.capacity, 0),
            active: rooms.filter(r => r.status === 'active').length,
            maintenance: rooms.filter(r => r.status === 'maintenance').length
        };
    }, [rooms]);

    const tabs = ['All', 'Classroom', 'Lab', 'Library', 'Auditorium'];

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Gestion des Salles</h1>
                    <p className="text-gray-500 mt-1">Gérez vos espaces d'apprentissage et équipements</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={openModalForNew}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                    >
                        <PlusCircle size={18} className="mr-2" /> Nouvelle Salle
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Salles"
                    value={stats.total}
                    icon={<Building size={24} />}
                    color="bg-blue-500"
                    trend="+2 ce mois"
                />
                <StatCard
                    title="Capacité Totale"
                    value={stats.capacity}
                    icon={<Users size={24} />}
                    color="bg-indigo-500"
                />
                <StatCard
                    title="Salles Actives"
                    value={stats.active}
                    icon={<Activity size={24} />}
                    color="bg-emerald-500"
                    trend="95% opérationnel"
                />
                <StatCard
                    title="Maintenance"
                    value={stats.maintenance}
                    icon={<Wrench size={24} />}
                    color="bg-amber-500"
                />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
                    <div className="flex p-1 bg-gray-100/80 rounded-xl overflow-x-auto max-w-full">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                                    ${activeTab === tab
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'}
                                `}
                            >
                                {tab === 'All' ? 'Toutes' : tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border-transparent focus:bg-white border focus:border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                            />
                        </div>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                            >
                                <ListIcon size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className={`p-6 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}`}>
                    {filteredRooms.map(room => (
                        <div
                            key={room.id}
                            className={`
                                group bg-white border border-gray-100 rounded-xl hover:shadow-lg transition-all duration-300
                                ${viewMode === 'list' ? 'flex items-center justify-between p-4' : 'flex flex-col'}
                                ${room.status === 'maintenance' ? 'bg-gray-50/50' : ''}
                            `}
                        >
                            <div className={`${viewMode === 'list' ? 'flex items-center gap-6' : 'p-5'}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-xl ${room.status === 'maintenance' ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-600'}`}>
                                        <RoomTypeIcon type={room.type} className="w-6 h-6" />
                                    </div>
                                    {viewMode === 'grid' && (
                                        <div className={`px-2.5 py-1 rounded-full text-xs font-medium border ${room.status === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-100'
                                                : 'bg-amber-50 text-amber-700 border-amber-100'
                                            }`}>
                                            {room.status === 'active' ? 'Active' : 'Maintenance'}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                                        {room.name}
                                    </h3>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                        <span className="flex items-center gap-1.5">
                                            <Users size={14} /> {room.capacity} places
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Building size={14} /> {room.type}
                                        </span>
                                    </div>
                                </div>

                                {viewMode === 'grid' && room.equipments.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-2">
                                        {room.equipments.slice(0, 3).map(eq => (
                                            <span key={eq} className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded-md border border-gray-100">
                                                {eq.replace('_', ' ')}
                                            </span>
                                        ))}
                                        {room.equipments.length > 3 && (
                                            <span className="px-2 py-1 text-xs bg-gray-50 text-gray-400 rounded-md border border-gray-100">
                                                +{room.equipments.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={`
                                ${viewMode === 'grid'
                                    ? 'px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-2'
                                    : 'flex items-center gap-2'}
                            `}>
                                <button
                                    onClick={() => toggleStatus(room)}
                                    className={`p-2 rounded-lg transition-colors ${room.status === 'active'
                                            ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                            : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                                        }`}
                                    title={room.status === 'active' ? "Mettre en maintenance" : "Activer"}
                                >
                                    <Wrench size={18} />
                                </button>
                                <button
                                    onClick={() => openModalForEdit(room)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    <Edit size={18} />
                                </button>
                                <button
                                    onClick={() => handleDelete(room)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredRooms.length === 0 && (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search size={24} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">Aucune salle trouvée</h3>
                        <p className="text-gray-500 mt-1">Essayez de modifier vos filtres ou ajoutez une nouvelle salle.</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                title={editingRoom ? 'Modifier la salle' : 'Nouvelle salle'}
                size="lg"
            >
                <form onSubmit={handleFormSubmit} className="flex flex-col h-full">
                    <div className="space-y-6">
                        {editingRoom && (
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <div>
                                    <h4 className="font-medium text-gray-900">Statut de la salle</h4>
                                    <p className="text-sm text-gray-500">Définir si la salle est opérationnelle</p>
                                </div>
                                <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status: 'active' }))}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${formData.status === 'active'
                                                ? 'bg-green-100 text-green-700 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        Active
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, status: 'maintenance' }))}
                                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${formData.status === 'maintenance'
                                                ? 'bg-amber-100 text-amber-700 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        Maintenance
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de la salle</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name || ''}
                                    onChange={handleFormChange}
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ex: Salle 101"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacité</label>
                                <input
                                    type="number"
                                    name="capacity"
                                    value={formData.capacity || ''}
                                    onChange={handleFormChange}
                                    required
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="Ex: 30"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {['Classroom', 'Lab', 'Library', 'Auditorium'].map(type => (
                                        <label
                                            key={type}
                                            className={`
                                                flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all
                                                ${formData.type === type
                                                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                                                    : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-gray-50'}
                                            `}
                                        >
                                            <input
                                                type="radio"
                                                name="type"
                                                value={type}
                                                checked={formData.type === type}
                                                onChange={handleFormChange}
                                                className="hidden"
                                            />
                                            <RoomTypeIcon type={type as Room['type']} className="w-6 h-6 mb-2" />
                                            <span className="text-xs font-medium">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-3">Équipements</h4>
                            <div className="space-y-4">
                                {Object.entries(TRAINING_ROOM_EQUIPMENT).map(([category, items]) => (
                                    <div key={category} className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{category}</h5>
                                        <div className="flex flex-wrap gap-2">
                                            {items.map(item => (
                                                <label
                                                    key={item}
                                                    className={`
                                                        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm
                                                        ${(formData.equipments || []).includes(item)
                                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/20'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}
                                                    `}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={(formData.equipments || []).includes(item)}
                                                        onChange={() => handleEquipmentChange(item)}
                                                        className="hidden"
                                                    />
                                                    {(formData.equipments || []).includes(item) && <Check size={14} />}
                                                    <span>{item.replace('_', ' ')}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button
                            type="button"
                            onClick={closeModal}
                            className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                            Annuler
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                        >
                            Enregistrer
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
