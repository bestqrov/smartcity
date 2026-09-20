import prisma from '../../config/database';
import { hashPassword } from '../../utils/bcrypt';
import { assertId } from '../transport/ids';
import { DEFAULT_INSTITUTION_TYPE, InstitutionTypeValue, isInstitutionType } from '../packs/packs.constants';

export interface SignupSchoolData {
    schoolName?: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password: string;
    branchName?: string;
    branchCity?: string;
    institutionType: InstitutionTypeValue;
    packCode?: string;
}

const TRIAL_DAYS = 15;

// The pack named by the visitor (must be active and serve the type), else the default pack if it
// serves the type, else none — signup never fails because no default pack exists.
const resolveSignupPack = async (packCode: unknown, type: InstitutionTypeValue) => {
    if (packCode !== undefined && packCode !== null && packCode !== '') {
        // packCode comes from a public request body: never let a non-string reach Prisma.
        const code = typeof packCode === 'string' ? packCode.trim() : '';
        if (!code) throw new Error('Unknown or unavailable pack');
        const pack = await prisma.pack.findFirst({ where: { code, active: true } });
        if (!pack || !pack.institutionTypes.includes(type)) throw new Error('Unknown or unavailable pack');
        return pack;
    }

    const defaultPack = await prisma.pack.findFirst({ where: { isDefault: true, active: true } });
    return defaultPack && defaultPack.institutionTypes.includes(type) ? defaultPack : null;
};

export const signupSchool = async (data: SignupSchoolData) => {
    if (!isInstitutionType(data.institutionType)) {
        throw new Error('institutionType is required and must be valid');
    }

    const email = data.ownerEmail.toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('Email already exists');
    }

    const pack = await resolveSignupPack(data.packCode, data.institutionType);

    const hashedPassword = await hashPassword(data.password);

    const schoolName = data.schoolName || `École de ${data.ownerName}`;
    const branchName = data.branchName || 'Établissement principal';
    const branchCity = data.branchCity ?? '';

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    try {
        return await prisma.$transaction(async (tx) => {
            const school = await tx.school.create({
                data: {
                    name: schoolName,
                    status: 'PENDING',
                    institutionType: data.institutionType,
                    packId: pack?.id ?? null,
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
    const school = await prisma.school.findUnique({ where: { id: schoolId }, include: { pack: true } });
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
            institutionType: true,
            packId: true,
            pack: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
    });
};

export const updateSchoolStatus = async (id: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED') => {
    return prisma.school.update({ where: { id }, data: { status } });
};

export const assignPackToSchool = async (schoolId: string, packId: string) => {
    assertId('School id', schoolId);
    assertId('Pack id', packId);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new Error('School not found');

    const pack = await prisma.pack.findFirst({ where: { id: packId, active: true } });
    if (!pack) throw new Error('Pack not found');

    const type = school.institutionType ?? DEFAULT_INSTITUTION_TYPE;
    if (!pack.institutionTypes.includes(type)) throw new Error('Pack does not serve this institution type');

    return prisma.school.update({ where: { id: schoolId }, data: { packId }, include: { pack: true } });
};
