// User types
export type UserRole = 'ADMIN' | 'SECRETARY' | 'SUPER_ADMIN';

export interface User {
    id: string;
    email: string;
    name: string;
    surname?: string;
    role: UserRole;
    createdAt: string;
}

// Student types
export interface Student {
    id: string;
    name: string;
    surname: string;
    phone?: string;
    email?: string;
    cin?: string;
    address?: string;
    birthDate?: string;
    birthPlace?: string;
    fatherName?: string;
    motherName?: string;
    parentName?: string;
    parentPhone?: string;
    parentRelation?: string;
    schoolLevel?: string;
    currentSchool?: string;
    subjects?: any; // JSON
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

// Inscription types
export type InscriptionType = 'SOUTIEN' | 'FORMATION';

export interface Inscription {
    id: string;
    studentId: string;
    student?: Student;
    type: InscriptionType;
    category: string;
    amount: number;
    date: string;
    note?: string;
    createdAt: string;
    updatedAt: string;
}

// Payment types
export interface Payment {
    id: string;
    studentId: string;
    student?: Student;
    amount: number;
    method: string;
    note?: string;
    date: string;
    createdAt: string;
    updatedAt: string;
}

// Attendance types
export interface Attendance {
    id: string;
    studentId: string;
    student?: Student;
    date: string;
    status: 'present' | 'absent';
    createdAt: string;
    updatedAt: string;
}

// Settings types
export interface Settings {
    id: string;
    schoolName: string;
    logo?: string;
    academicYear: string;
    contactInfo?: string;
    createdAt: string;
    updatedAt: string;
}

// API Response types
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface ApiError {
    success: false;
    error: string;
    message?: string;
}

// Auth types
export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    token: string;
    user: User;
}

export interface RegisterAdminRequest {
    email: string;
    password: string;
    name: string;
}

// Form types
export interface StudentFormData {
    name: string;
    surname: string;
    phone?: string;
    email?: string;
    cin?: string;
    address?: string;
    birthDate?: string;
    birthPlace?: string;
    fatherName?: string;
    motherName?: string;
    parentName?: string;
    parentPhone?: string;
    parentRelation?: string;
    schoolLevel?: string;
    currentSchool?: string;
    subjects?: any;
}

export interface InscriptionFormData {
    studentId: string;
    type: InscriptionType;
    category: string;
    amount: number;
    date?: string;
    note?: string;
}

export interface PaymentFormData {
    studentId: string;
    amount: number;
    method: string;
    note?: string;
    date?: string;
}

export interface AttendanceFormData {
    studentId: string;
    date: string;
    status: 'present' | 'absent';
}

export interface UserFormData {
    email: string;
    password?: string;
    name: string;
    role: UserRole;
}

export interface SettingsFormData {
    schoolName: string;
    logo?: string;
    academicYear: string;
    contactInfo?: string;
}

// Category options
export const SOUTIEN_CATEGORIES = [
    'math',
    'physique',
    'svt',
    'francais',
    'anglais',
    'calcul_mental',
    'couran',
    'autre',
] as const;

export const FORMATION_CATEGORIES = [
    'coiffure',
    'bureautique',
    'ecommerce',
    'autre',
] as const;

export type SoutienCategory = typeof SOUTIEN_CATEGORIES[number];
export type FormationCategory = typeof FORMATION_CATEGORIES[number];

export interface Group {
    id: string;
    name: string;
    subject: string;
    niveau: string;
    teacherName?: string;
    whatsappGroup?: string;
    studentIds: string[];
}

export interface Teacher {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    cin?: string;
    dob?: string;
    gender?: string;
    picture?: string;
    status: 'Active' | 'Inactive';
    socialMedia?: {
        linkedin?: string;
        twitter?: string;
        facebook?: string;
        whatsapp?: string;
    };
    hourlyRate: number;
    paymentType: 'HOURLY' | 'FIXED' | 'PERCENTAGE';
    commission?: number;
    specialties: string[];
    levels: string[];
    createdAt: string;
    updatedAt: string;
    _count?: {
        groups: number;
    };
}
