import prisma from '../../config/database';

export interface AnnouncementData {
    title: string;
    body: string;
    branchId: string;
}

export interface UpdateAnnouncementData {
    title?: string;
    body?: string;
    active?: boolean;
}

export const getAllAnnouncements = async (branchId: string) => {
    return prisma.announcement.findMany({
        where: { branchId, active: true },
        orderBy: { createdAt: 'desc' },
    });
};

export const createAnnouncement = async (data: AnnouncementData) => {
    return prisma.announcement.create({
        data: {
            title: data.title,
            body: data.body,
            branchId: data.branchId,
        },
    });
};

export const updateAnnouncement = async (id: string, branchId: string, data: UpdateAnnouncementData) => {
    const existing = await prisma.announcement.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Announcement not found');

    return prisma.announcement.update({ where: { id }, data });
};

export const deleteAnnouncement = async (id: string, branchId: string) => {
    const existing = await prisma.announcement.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Announcement not found');

    return prisma.announcement.update({ where: { id }, data: { active: false } });
};
