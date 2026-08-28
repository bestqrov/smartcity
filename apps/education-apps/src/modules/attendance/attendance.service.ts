import prisma from '../../config/database';

interface CreateAttendanceData {
    studentId: string;
    date: Date;
    status: string;
}

export const createAttendance = async (data: CreateAttendanceData) => {
    const { studentId, date, status } = data;

    // Validate status
    if (!['present', 'absent'].includes(status)) {
        throw new Error('Status must be either "present" or "absent"');
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
        where: { id: studentId },
    });

    if (!student) {
        throw new Error('Student not found');
    }

    const attendance = await prisma.attendance.create({
        data: {
            studentId,
            date,
            status,
        },
        include: {
            student: true,
        },
    });

    return attendance;
};

export const getAttendanceByStudent = async (studentId: string) => {
    // Check if student exists
    const student = await prisma.student.findUnique({
        where: { id: studentId },
    });

    if (!student) {
        throw new Error('Student not found');
    }

    const attendances = await prisma.attendance.findMany({
        where: { studentId },
        include: {
            student: true,
        },
        orderBy: {
            date: 'desc',
        },
    });

    return attendances;
};
