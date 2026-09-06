import { Request, Response } from 'express';
import prisma from '../../config/database';
import {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudent,
    deleteStudent,
    getStudentAnalytics,
    regenerateStudentToken,
    regenerateStudentPortalToken,
    getStudentByPortalToken,
} from './students.service';
import { sendSuccess, sendError } from '../../utils/response';
import { TenantRequest } from '../../middlewares/tenantScope.middleware';

const stripTokenHash = <T extends { accessTokenHash?: string; portalTokenHash?: string | null }>(student: T) => {
    const { accessTokenHash, portalTokenHash, ...rest } = student;
    return rest;
};

export const create = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const {
            name, surname, phone, email, cin, address, birthDate,
            birthPlace, fatherName, motherName, schoolLevel, currentSchool, subjects, photo,
            parentName, parentPhone, parentRelation
        } = req.body;

        // Validate required fields
        if (!name || !surname) {
            sendError(res, 'Name and surname are required', 'Validation error', 400);
            return;
        }

        const studentData: any = { name, surname, branchId: req.branchId! };
        if (phone) studentData.phone = phone;
        if (email) studentData.email = email;
        if (cin) studentData.cin = cin;
        if (address) studentData.address = address;
        if (birthDate) studentData.birthDate = new Date(birthDate);
        if (birthPlace) studentData.birthPlace = birthPlace;
        if (fatherName) studentData.fatherName = fatherName;
        if (motherName) studentData.motherName = motherName;
        if (schoolLevel) studentData.schoolLevel = schoolLevel;
        if (currentSchool) studentData.currentSchool = currentSchool;
        if (subjects) studentData.subjects = subjects;
        if (photo) studentData.photo = photo;
        if (req.body.inscriptionFee) studentData.inscriptionFee = req.body.inscriptionFee;
        if (req.body.subjectsTotal) studentData.subjectsTotal = req.body.subjectsTotal;
        if (req.body.amountPaid) studentData.amountPaid = req.body.amountPaid;
        if (parentName) studentData.parentName = parentName;
        if (parentPhone) studentData.parentPhone = parentPhone;
        if (parentRelation) studentData.parentRelation = parentRelation;

        const student = await createStudent(studentData);

        sendSuccess(res, stripTokenHash(student), 'Student created successfully', 201);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to create student', 400);
    }
};

export const getAll = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const students = await getAllStudents(req.branchId!);
        sendSuccess(res, students.map(stripTokenHash), 'Students retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve students', 500);
    }
};

export const getById = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const student = await getStudentById(id, req.branchId!);
        sendSuccess(res, stripTokenHash(student), 'Student retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve student', 404);
    }
};

export const update = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            name, surname, phone, email, cin, address, birthDate,
            birthPlace, fatherName, motherName, schoolLevel, currentSchool, subjects, photo,
            parentName, parentPhone, parentRelation, parentId
        } = req.body;

        const updateData: any = {};
        if (name) updateData.name = name;
        if (surname) updateData.surname = surname;
        if (phone !== undefined) updateData.phone = phone;
        if (email !== undefined) updateData.email = email;
        if (cin !== undefined) updateData.cin = cin;
        if (address !== undefined) updateData.address = address;
        if (birthDate) updateData.birthDate = new Date(birthDate);
        if (birthPlace !== undefined) updateData.birthPlace = birthPlace;
        if (fatherName !== undefined) updateData.fatherName = fatherName;
        if (motherName !== undefined) updateData.motherName = motherName;
        if (schoolLevel !== undefined) updateData.schoolLevel = schoolLevel;
        if (currentSchool !== undefined) updateData.currentSchool = currentSchool;
        if (subjects !== undefined) updateData.subjects = subjects;
        if (photo !== undefined) updateData.photo = photo;
        if (parentName !== undefined) updateData.parentName = parentName;
        if (parentPhone !== undefined) updateData.parentPhone = parentPhone;
        if (parentRelation !== undefined) updateData.parentRelation = parentRelation;
        if (parentId !== undefined) updateData.parentId = parentId;

        const student = await updateStudent(id, req.branchId!, updateData);

        sendSuccess(res, stripTokenHash(student), 'Student updated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to update student', 400);
    }
};

export const regenerateToken = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { student, rawToken } = await regenerateStudentToken(req.params.id, req.branchId!);
        sendSuccess(res, { student: stripTokenHash(student), rawToken }, 'Token regenerated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to regenerate token', 400);
    }
};

export const regeneratePortalToken = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { student, rawToken } = await regenerateStudentPortalToken(req.params.id, req.branchId!);
        sendSuccess(res, { student: stripTokenHash(student), rawToken }, 'Portal link regenerated successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to regenerate portal link', 400);
    }
};

export const getPublicProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const student = await getStudentByPortalToken(req.params.token);

        if (!student) {
            sendError(res, 'Not found', 'Not found', 404);
            return;
        }

        await prisma.accessLog.create({
            data: { studentId: student.id, ip: req.ip },
        });

        sendSuccess(res, stripTokenHash(student), 'Profile retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, 'Not found', 'Not found', 404);
    }
};

export const remove = async (req: TenantRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const result = await deleteStudent(id, req.branchId!);
        sendSuccess(res, result, 'Student deleted successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to delete student', 404);
    }
};

export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
        const analytics = await getStudentAnalytics();
        sendSuccess(res, analytics, 'Analytics retrieved successfully', 200);
    } catch (error: any) {
        sendError(res, error.message, 'Failed to retrieve analytics', 500);
    }
};
