import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';

export interface SignupSchoolData {
    schoolName: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName: string;
    branchCity: string;
    packTier: string;
}

export const signupSchool = async (data: SignupSchoolData) => {
    const email = data.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const hashedPassword = await hashPassword(data.password);

    try {
        return await prisma.$transaction(async (tx) => {
            const school = await tx.school.create({
                data: {
                    name: data.schoolName,
                    status: 'PENDING',
                    packTier: data.packTier,
                    ownerName: data.ownerName,
                    ownerEmail: email,
                    ownerPhone: data.ownerPhone,
                },
            });

            const branch = await tx.branch.create({
                data: {
                    schoolId: school.id,
                    name: data.branchName,
                    city: data.branchCity,
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
