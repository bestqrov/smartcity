import { notifySafely } from '../notifications/dispatcher';
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
    const announcement = await prisma.announcement.create({
        data: {
            title: data.title,
            body: data.body,
            branchId: data.branchId,
        },
    });
    if (announcement.active !== false) {
        try {
            const parents = await prisma.parent.findMany({ where: { branchId: data.branchId }, select: { id: true } });
            await notifySafely(parents.map((p) => p.id), {
                kind: 'ANNOUNCEMENT',
                branchId: data.branchId,
                title: { fr: announcement.title, ar: announcement.title },
                body: { fr: announcement.body, ar: announcement.body },
            });
        } catch (error) {
            console.error('[announcements] failed to notify parents:', error);
        }
    }
    return announcement;
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
