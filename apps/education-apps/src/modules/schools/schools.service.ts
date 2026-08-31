import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';

export interface SignupSchoolData {
    schoolName?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName?: string;
    branchCity?: string;
    packTier?: string;
}

const TRIAL_DAYS = 15;

export const signupSchool = async (data: SignupSchoolData) => {
    const email = data.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const hashedPassword = await hashPassword(data.password);

    const schoolName = data.schoolName || `École de ${data.ownerName}`;
    const branchName = data.branchName || 'Établissement principal';
    const branchCity = data.branchCity ?? '';
    const packTier = data.packTier || 'basic';

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    try {
        return await prisma.$transaction(async (tx) => {
            const school = await tx.school.create({
                data: {
                    name: schoolName,
                    status: 'PENDING',
                    packTier,
                    ownerName: data.ownerName,
                    ownerEmail: email,
                    ownerPhone: data.ownerPhone,
                    trialEndsAt,
                },
            });

            const branch = await tx.branch.create({
                data: {
                    schoolId: school.id,
                    name: branchName,
                    city: branchCity,
                },
            });

            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: data.ownerName,
                    role: 'OWNER',
                    schoolId: school.id,
                },
            });

            return { school, branch, user };
        });
    } catch (error) {
        if ((error as any)?.code === 'P2002') {
            throw new Error('Email already exists');
        }
        throw error;
    }
};

export const getSchoolBySchoolId = async (schoolId: string) => {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
        throw new Error('School not found');
    }
    return school;
};

export interface UpdateSchoolProfileData {
    name?: string;
    director?: string;
    city?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo?: string;
}

export const updateSchoolProfile = async (schoolId: string, data: UpdateSchoolProfileData) => {
    return prisma.school.update({ where: { id: schoolId }, data });
};

export const listSchools = async () => {
    return prisma.school.findMany({
        select: {
            id: true,
            name: true,
            ownerEmail: true,
            status: true,
            trialEndsAt: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });
};

export const updateSchoolStatus = async (id: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED') => {
    return prisma.school.update({ where: { id }, data: { status } });
};
