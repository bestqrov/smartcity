import prisma from '../../config/database';

interface UpdateSettingsData {
    schoolName?: string;
    logo?: string;
    academicYear?: string;
    contactInfo?: string;
}

export const getSettings = async (branchId: string) => {
    let settings = await prisma.settings.findFirst({ where: { branchId } });

    if (!settings) {
        settings = await prisma.settings.create({
            data: {
                branchId,
                schoolName: 'School Name',
                academicYear: '2024-2025',
                logo: null,
                contactInfo: null,
            },
        });
    }

    return settings;
};

export const updateSettings = async (branchId: string, data: UpdateSettingsData) => {
    let settings = await prisma.settings.findFirst({ where: { branchId } });

    if (!settings) {
        settings = await prisma.settings.create({
            data: {
                branchId,
                schoolName: data.schoolName || 'School Name',
                academicYear: data.academicYear || '2024-2025',
                logo: data.logo || null,
                contactInfo: data.contactInfo || null,
            },
        });
    } else {
        settings = await prisma.settings.update({
            where: { id: settings.id },
            data,
        });
    }

    return settings;
};
