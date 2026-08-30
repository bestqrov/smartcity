import prisma from '../../config/database';

export interface CreateTeacherData {
    name: string;
    branchId: string;
    email?: string;
    phone?: string;
    cin?: string;
    dob?: Date | string;
    gender?: string;
    picture?: string;
    status?: string;
    socialMedia?: any;
    hourlyRate?: number;
    paymentType?: string;
    commission?: number;
    specialties?: string[];
    levels?: string[];
}

export interface UpdateTeacherData {
    name?: string;
    email?: string;
    phone?: string;
    cin?: string;
    dob?: Date | string;
    gender?: string;
    picture?: string;
    status?: string;
    socialMedia?: any;
    hourlyRate?: number;
    paymentType?: string;
    commission?: number;
    specialties?: string[];
    levels?: string[];
}

export const createTeacher = async (data: CreateTeacherData) => {
    return await prisma.teacher.create({
        data
    });
};

export const getAllTeachers = async (branchId: string) => {
    return await prisma.teacher.findMany({
        where: { branchId },
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { groups: true }
            }
        }
    });
};

export const updateTeacher = async (id: string, branchId: string, data: UpdateTeacherData) => {
    const existing = await prisma.teacher.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Teacher not found');

    const {
        name, email, phone, cin, dob, gender, picture, status,
        socialMedia, hourlyRate, paymentType, commission, specialties, levels
    } = data;

    return await prisma.teacher.update({
        where: { id },
        data: {
            name, email, phone, cin, dob, gender, picture, status,
            socialMedia, hourlyRate, paymentType, commission, specialties, levels
        }
    });
};

export const deleteTeacher = async (id: string, branchId: string) => {
    const existing = await prisma.teacher.findFirst({ where: { id, branchId } });
    if (!existing) throw new Error('Teacher not found');

    return await prisma.teacher.delete({
        where: { id }
    });
};

export const calculateMonthlyTeacherExpenses = async () => {
    // Aggregate across all branches — intentionally left unscoped, see plan notes.
    const teachers = await prisma.teacher.findMany({
        include: {
            groups: {
                include: {
                    students: true,
                    _count: {
                        select: { students: true }
                    }
                }
            }
        }
    });

    let totalExpenses = 0;

    for (const teacher of teachers) {
        let teacherExpense = 0;

        if (teacher.paymentType === 'FIXED') {
            teacherExpense = teacher.hourlyRate || 0;
        } else if (teacher.paymentType === 'HOURLY') {
            const totalHours = teacher.groups.length * 8;
            teacherExpense = totalHours * (teacher.hourlyRate || 0);
        } else if (teacher.paymentType === 'PERCENTAGE') {
            const totalStudents = teacher.groups.reduce((sum, group) => sum + group._count.students, 0);
            const estimatedRevenue = totalStudents * 500;
            teacherExpense = estimatedRevenue * ((teacher.commission || 0) / 100);
        }

        totalExpenses += teacherExpense;
    }

    return {
        totalTeacherExpenses: totalExpenses,
        teacherCount: teachers.length
    };
};
