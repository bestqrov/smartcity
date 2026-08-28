import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { UserRole } from '@prisma/client';

interface CreateUserData {
    email: string;
    password: string;
    name: string;
    role: UserRole;
}

interface UpdateUserData {
    email?: string;
    password?: string;
    name?: string;
    role?: UserRole;
}

export const createUser = async (data: CreateUserData) => {
    const email = data.email.toLowerCase();
    const { password, name, role } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new Error('Email already exists');
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

export const getAllUsers = async () => {
    const users = await prisma.user.findMany({
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

export const getUserById = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
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

export const updateUser = async (id: string, data: UpdateUserData) => {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
        where: { id },
    });

    if (!existingUser) {
        throw new Error('User not found');
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

export const deleteUser = async (id: string) => {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
        where: { id },
    });

    if (!existingUser) {
        throw new Error('User not found');
    }

    await prisma.user.delete({
        where: { id },
    });

    return { message: 'User deleted successfully' };
};

// Secretary-specific functions
export const getSecretaries = async () => {
    const secretaries = await prisma.user.findMany({
        where: { role: 'SECRETARY' },
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

export const updateSecretary = async (id: string, data: {
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
    // Check if user exists and is a secretary
    const existingUser = await prisma.user.findUnique({
        where: { id },
    });

    if (!existingUser) {
        throw new Error('Secretary not found');
    }

    if (existingUser.role !== 'SECRETARY') {
        throw new Error('User is not a secretary');
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

