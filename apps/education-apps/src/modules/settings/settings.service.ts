import prisma from '../../config/database';

interface UpdateSettingsData {
    schoolName?: string;
    logo?: string;
    academicYear?: string;
    contactInfo?: string;
}

export const getSettings = async () => {
    // Get the first (and only) settings record
    let settings = await prisma.settings.findFirst();

    // If no settings exist, create default settings
    if (!settings) {
        settings = await prisma.settings.create({
            data: {
                schoolName: 'School Name',
                academicYear: '2024-2025',
                logo: null,
                contactInfo: null,
            },
        });
    }

    return settings;
};

export const updateSettings = async (data: UpdateSettingsData) => {
    // Get existing settings
    let settings = await prisma.settings.findFirst();

    if (!settings) {
        // Create new settings if none exist
        settings = await prisma.settings.create({
            data: {
                schoolName: data.schoolName || 'School Name',
                academicYear: data.academicYear || '2024-2025',
                logo: data.logo || null,
                contactInfo: data.contactInfo || null,
            },
        });
    } else {
        // Update existing settings
        settings = await prisma.settings.update({
            where: { id: settings.id },
            data,
        });
    }

    return settings;
};
