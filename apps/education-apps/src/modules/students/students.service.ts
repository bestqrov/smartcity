import prisma from '../../config/database';
import { generateRawToken, hashToken } from '../../utils/accessToken';

interface CreateStudentData {
    branchId: string;
    name: string;
    surname: string;
    phone?: string;
    email?: string;
    cin?: string;
    address?: string;
    birthDate?: Date;
    birthPlace?: string;
    fatherName?: string;
    motherName?: string;
    parentName?: string;
    parentPhone?: string;
    parentRelation?: string;
    schoolLevel?: string;
    currentSchool?: string;
    subjects?: any;
    photo?: string;
    active?: boolean;
}

interface UpdateStudentData {
    name?: string;
    surname?: string;
    phone?: string;
    email?: string;
    cin?: string;
    address?: string;
    birthDate?: Date;
    birthPlace?: string;
    fatherName?: string;
    motherName?: string;
    parentName?: string;
    parentPhone?: string;
    parentRelation?: string;
    schoolLevel?: string;
    currentSchool?: string;
    subjects?: any;
    photo?: string;
    active?: boolean;
    parentId?: string | null;
}

export const createStudent = async (data: CreateStudentData & { inscriptionFee?: number; amountPaid?: number }) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Create Student
        const student = await tx.student.create({
            data: {
                branchId: data.branchId,
                name: data.name,
                surname: data.surname,
                phone: data.phone,
                email: data.email,
                cin: data.cin,
                address: data.address,
                birthDate: data.birthDate,
                birthPlace: data.birthPlace,
                fatherName: data.fatherName,
                motherName: data.motherName,
                parentName: data.parentName,
                parentPhone: data.parentPhone,
                parentRelation: data.parentRelation,
                schoolLevel: data.schoolLevel,
                currentSchool: data.currentSchool,
                subjects: data.subjects,
                photo: data.photo,
                active: data.active ?? true,
                accessTokenHash: hashToken(generateRawToken()),
                portalTokenHash: hashToken(generateRawToken()),
            },
        });

        // 2. Create Inscription if fee is provided
        console.log('DEBUG: inscriptionFee is', data.inscriptionFee);
        if (data.inscriptionFee !== undefined) {
            console.log('DEBUG: Creating inscription...');
            await tx.inscription.create({
                data: {
                    studentId: student.id,
                    branchId: data.branchId,
                    type: 'SOUTIEN',
                    category: data.schoolLevel || 'Unknown',
                    amount: data.inscriptionFee,
                    date: new Date(),
                    note: 'Inscription initiale',
                },
            });
            console.log('DEBUG: Inscription created.');
        }

        // 3. Create Payment if amount is provided
        if (data.amountPaid !== undefined && data.amountPaid > 0) {
            await tx.payment.create({
                data: {
                    studentId: student.id,
                    branchId: data.branchId,
                    amount: data.amountPaid,
                    method: 'CASH', // Default to CASH for now
                    date: new Date(),
                    note: 'Paiement à l\'inscription',
                },
            });
        }

        return student;
    });
};

export const getAllStudents = async (branchId: string) => {
    const students = await prisma.student.findMany({
        where: { branchId },
        include: {
            inscriptions: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return students;
};

// Pattern: every branch-scoped lookup below does findFirst({ id, branchId }) as the
// authorization check, then mutates by bare `id` alone. This is safe ONLY because
// MongoDB ObjectIds are globally unique — once findFirst confirms this id belongs to
// this branch, no other document can share that id, so the later update/delete/etc.
// by id alone is mechanically incapable of hitting a different document. If a future
// module's lookup key is NOT globally unique on its own, this shortcut is unsafe —
// keep branchId in the mutating call's `where` too in that case.
export const getStudentById = async (id: string, branchId: string) => {
    const student = await prisma.student.findFirst({
        where: { id, branchId },
        include: {
            inscriptions: true,
            payments: true,
            attendances: true,
            parent: true,
        },
    });

    if (!student) {
        throw new Error('Student not found');
    }

    return student;
};

export const updateStudent = async (id: string, branchId: string, data: UpdateStudentData) => {
    // Check if student exists
    const existingStudent = await prisma.student.findFirst({ where: { id, branchId } });

    if (!existingStudent) {
        throw new Error('Student not found');
    }

    const student = await prisma.student.update({
        where: { id },
        data,
    });

    return student;
};

export const deleteStudent = async (id: string, branchId: string) => {
    // Check if student exists
    const existingStudent = await prisma.student.findFirst({ where: { id, branchId } });

    if (!existingStudent) {
        throw new Error('Student not found');
    }

    await prisma.student.delete({
        where: { id },
    });

    return { message: 'Student deleted successfully' };
};

export const regenerateStudentToken = async (id: string, branchId: string) => {
    const existingStudent = await prisma.student.findFirst({ where: { id, branchId } });

    if (!existingStudent) {
        throw new Error('Student not found');
    }

    const rawToken = generateRawToken();

    const student = await prisma.student.update({
        where: { id },
        data: { accessTokenHash: hashToken(rawToken) },
    });

    return { student, rawToken };
};

// Separate from regenerateStudentToken above: that one is the attendance QR (scanned by
// staff), this one is the student's own passwordless profile link (like Parent.accessTokenHash).
export const regenerateStudentPortalToken = async (id: string, branchId: string) => {
    const existingStudent = await prisma.student.findFirst({ where: { id, branchId } });

    if (!existingStudent) {
        throw new Error('Student not found');
    }

    const rawToken = generateRawToken();

    const student = await prisma.student.update({
        where: { id },
        data: { portalTokenHash: hashToken(rawToken) },
    });

    return { student, rawToken };
};

export const getStudentByPortalToken = async (rawToken: string) => {
    const portalTokenHash = hashToken(rawToken);

    return prisma.student.findUnique({
        where: { portalTokenHash },
        include: { inscriptions: true, payments: true, attendances: true },
    });
};

// Helpers removed as global pricing is deprecated

export const getStudentAnalytics = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    // Set endOfMonth to end of the day
    endOfMonth.setHours(23, 59, 59, 999);

    const totalStudents = await prisma.student.count();
    const totalInscriptions = await prisma.inscription.count({
        where: { type: 'SOUTIEN' }
    });

    // 1. Calculate Recurring Monthly Revenue from ALL Students
    // We assume all students in the database are "Active"
    const allStudents = await prisma.student.findMany();

    let monthlyRevenue = 0;

    console.log(`DEBUG ANALYTICS: Calculating recurring revenue for ${allStudents.length} students (Manual Pricing mode)...`);

    for (const student of allStudents) {
        if (student.subjects) {
            const subjects = student.subjects as Record<string, any>;
            let studentTotal = 0;

            for (const [subject, value] of Object.entries(subjects)) {
                // In manual mode, value should be the price (number)
                // We handle legacy boolean 'true' as 0
                if (typeof value === 'number') {
                    studentTotal += value;
                } else if (value === true) {
                    console.warn(`Warning: Student ${student.id} has legacy boolean subject ${subject}, treating as 0`);
                }
            }
            monthlyRevenue += studentTotal;
        }
    }
    console.log(`DEBUG ANALYTICS: Total Recurring Revenue: ${monthlyRevenue}`);

    // 2. Add One-time Inscription Fees from THIS MONTH only
    // (New students joining this month usually pay an inscription fee)
    const monthlyInscriptions = await prisma.inscription.findMany({
        where: {
            type: 'SOUTIEN',
            createdAt: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        }
    });

    for (const inscription of monthlyInscriptions) {
        monthlyRevenue += inscription.amount;
    }
    console.log(`DEBUG ANALYTICS: Total Revenue (Recurring + New Inscriptions): ${monthlyRevenue}`);

    // Get recent inscriptions
    const recentInscriptions = await prisma.inscription.findMany({
        where: { type: 'SOUTIEN' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            student: true
        }
    });

    const recentInscriptionsWithTotal = recentInscriptions.map(inscription => {
        let totalAmount = inscription.amount;
        const student = inscription.student;

        if (student && student.subjects) {
            const subjects = student.subjects as Record<string, any>;
            for (const [subject, value] of Object.entries(subjects)) {
                if (typeof value === 'number') {
                    totalAmount += value;
                }
            }
        }

        return {
            ...inscription,
            amount: totalAmount
        };
    });

    return {
        totalStudents,
        totalInscriptions,
        totalRevenue: monthlyRevenue,
        recentInscriptions: recentInscriptionsWithTotal,
        debugInfo: {
            mode: 'MANUAL_PRICING',
            studentDetails: allStudents.map(s => ({
                id: s.id,
                subjects: s.subjects,
                calculatedRevenue: (() => {
                    let total = 0;
                    if (s.subjects) {
                        for (const [, val] of Object.entries(s.subjects as Record<string, any>)) {
                            if (typeof val === 'number') total += val;
                        }
                    }
                    return total;
                })()
            }))
        }
    };
};
