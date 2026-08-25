export enum StudentStatus {
  ACTIVE = "ACTIVE",
  WITHDRAWN = "WITHDRAWN",
  GRADUATED = "GRADUATED",
}

export interface IBranch {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudent {
  id: string;
  tenantId: string;
  branchId: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum GuardianRelationshipType {
  MOTHER = "MOTHER",
  FATHER = "FATHER",
  GUARDIAN = "GUARDIAN",
  OTHER = "OTHER",
}

export interface IGuardian {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStudentGuardian {
  id: string;
  tenantId: string;
  studentId: string;
  guardianId: string;
  relationshipType: GuardianRelationshipType;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  canPickUp: boolean;
  canCommunicate: boolean;
  financiallyResponsible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum PaymentType {
  HOURLY = "HOURLY",
  FIXED = "FIXED",
  PERCENTAGE = "PERCENTAGE",
}

export interface ITeacher {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  specialties: string[];
  levels: string[];
  hourlyRate: number;
  paymentType: PaymentType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroup {
  id: string;
  tenantId: string;
  branchId: string;
  name: string;
  level?: string;
  subject?: string;
  room?: string;
  teacherId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupStudent {
  id: string;
  tenantId: string;
  groupId: string;
  studentId: string;
  createdAt: Date;
}

export enum AttendanceStatus {
  PRESENT = "PRESENT",
  ABSENT = "ABSENT",
  LATE = "LATE",
  EXCUSED = "EXCUSED",
}

export interface IAttendance {
  id: string;
  tenantId: string;
  groupId: string;
  studentId: string;
  date: Date;
  status: AttendanceStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionType {
  INCOME = "INCOME",
  EXPENSE = "EXPENSE",
}

export interface ITransaction {
  id: string;
  tenantId: string;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment {
  id: string;
  tenantId: string;
  studentId: string;
  transactionId: string;
  amount: number;
  method: string;
  notes?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum InscriptionType {
  SOUTIEN = "SOUTIEN",
  FORMATION = "FORMATION",
}

export interface IInscription {
  id: string;
  tenantId: string;
  studentId: string;
  type: InscriptionType;
  category: string;
  amount: number;
  date: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFormation {
  id: string;
  tenantId: string;
  name: string;
  duration: string;
  price: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
