import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { UserRole } from '@prisma/client';

interface CreateUserData {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    // Omitted only by the one-time /auth/register-admin bootstrap, which predates branches.
    branchId?: string;
}

// Every lookup below is restricted to the caller's branch, and only ADMIN/SECRETARY accounts can be
// managed here — never an OWNER or SUPER_ADMIN (changing their password would hand over the account).
const MANAGEABLE_ROLES: UserRole[] = ['ADMIN', 'SECRETARY'];

const findManageableUser = async (id: string, branchId: string) => {
    const user = await prisma.user.findFirst({
        where: { id, branchId, role: { in: MANAGEABLE_ROLES } },
    });
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

interface UpdateUserData {
    email?: string;
    password?: string;
    name?: string;
    role?: UserRole;
}

export const createUser = async (data: CreateUserData) => {
    const email = data.email.toLowerCase();
    const { password, name, role, branchId } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new Error('Email already exists');
    }

    const branch = branchId ? await prisma.branch.findUnique({ where: { id: branchId } }) : null;
    if (branchId && !branch) {
        throw new Error('Branch not found');
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            name,
            role,
            ...(branch ? { branchId: branch.id, schoolId: branch.schoolId } : {}),
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
        },
    });

    return user;
};

export const getAllUsers = async (branchId: string) => {
    const users = await prisma.user.findMany({
        where: { branchId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatar: true,
            gsm: true,
            whatsapp: true,
            address: true,
            schoolLevel: true,
            certification: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return users;
};

export const getUserById = async (id: string, branchId: string) => {
    const user = await prisma.user.findFirst({
        where: { id, branchId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatar: true,
            gsm: true,
            whatsapp: true,
            address: true,
            schoolLevel: true,
            certification: true,
            createdAt: true,
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    return user;
};

export const updateUser = async (id: string, branchId: string, data: UpdateUserData) => {
    const existingUser = await findManageableUser(id, branchId);

    // If email is being updated, check for duplicates
    if (data.email) {
        data.email = data.email.toLowerCase();
    }

    if (data.email && data.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (emailExists) {
            throw new Error('Email already exists');
        }
    }

    // Hash password if it's being updated
    const updateData: any = { ...data };
    if (data.password) {
        updateData.password = await hashPassword(data.password);
    }

    const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatar: true,
            gsm: true,
            whatsapp: true,
            address: true,
            schoolLevel: true,
            certification: true,
            createdAt: true,
        },
    });

    return user;
};

export const deleteUser = async (id: string, branchId: string) => {
    await findManageableUser(id, branchId);

    await prisma.user.delete({
        where: { id },
    });

    return { message: 'User deleted successfully' };
};

// Secretary-specific functions
export const getSecretaries = async (branchId: string) => {
    const secretaries = await prisma.user.findMany({
        where: { branchId, role: 'SECRETARY' },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatar: true,
            gsm: true,
            whatsapp: true,
            address: true,
            schoolLevel: true,
            certification: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });

    return secretaries;
};

export const updateSecretary = async (id: string, branchId: string, data: {
    email?: string;
    password?: string;
    name?: string;
    avatar?: string;
    gsm?: string;
    whatsapp?: string;
    address?: string;
    schoolLevel?: string;
    certification?: string;
}) => {
    const existingUser = await prisma.user.findFirst({
        where: { id, branchId, role: 'SECRETARY' },
    });

    if (!existingUser) {
        throw new Error('Secretary not found');
    }

    // If email is being updated, check for duplicates
    if (data.email) {
        data.email = data.email.toLowerCase();
    }

    if (data.email && data.email !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (emailExists) {
            throw new Error('Email already exists');
        }
    }

    // Hash password if it's being updated
    const updateData: any = { ...data };
    if (data.password) {
        updateData.password = await hashPassword(data.password);
    }

    const secretary = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatar: true,
            gsm: true,
            whatsapp: true,
            address: true,
            schoolLevel: true,
            certification: true,
            createdAt: true,
        },
    });

    return secretary;
};

