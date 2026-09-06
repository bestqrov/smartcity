import prisma from '../../config/database';

export interface HolidayData {
    title: string;
    startDate: Date;
    endDate: Date;
    branchId: string;
}

export interface UpdateHolidayData {
    title?: string;
    startDate?: Date;
    endDate?: Date;
    active?: boolean;
}

export const getAllHolidays = async (branchId: string) => {
    return prisma.holiday.findMany({
        where: { branchId, active: true },
        orderBy: { startDate: 'asc' },
    });
};

export const createHoliday = async (data: HolidayData) => {
    return prisma.holiday.create({
        data: {
            title: data.title,
            startDate: data.startDate,
            endDate: data.endDate,
            branchId: data.branchId,
        },
    });
};

export const updateHoliday = async (id: string, branchId: string, data: UpdateHolidayData) => {
    const existing = await prisma.holiday.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Holiday not found');

    return prisma.holiday.update({ where: { id }, data });
};

export const deleteHoliday = async (id: string, branchId: string) => {
    const existing = await prisma.holiday.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Holiday not found');

    return prisma.holiday.update({ where: { id }, data: { active: false } });
};
