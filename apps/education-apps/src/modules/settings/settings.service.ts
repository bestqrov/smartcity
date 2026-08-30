import prisma from '../../config/database';

interface UpdateSettingsData {
    schoolName?: string;
    logo?: string;
    academicYear?: string;
    contactInfo?: string;
}

export const getSettings = async (branchId: string) => {
    return prisma.settings.upsert({
        where: { branchId },
        update: {},
        create: {
            branchId,
            schoolName: 'School Name',
            academicYear: '2024-2025',
            logo: null,
            contactInfo: null,
        },
    });
};

export const updateSettings = async (branchId: string, data: UpdateSettingsData) => {
    return prisma.settings.upsert({
        where: { branchId },
        update: data,
        create: {
            branchId,
            schoolName: data.schoolName || 'School Name',
            academicYear: data.academicYear || '2024-2025',
            logo: data.logo || null,
            contactInfo: data.contactInfo || null,
        },
    });
};
