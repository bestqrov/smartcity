import prisma from '../../config/database';

export const getStudentsForDocuments = async () => {
    const students = await prisma.student.findMany({
        include: {
            inscriptions: {
                orderBy: {
                    date: 'desc'
                }
            },
            payments: {
                orderBy: {
                    date: 'desc'
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return students;
};

export const getStudentDocument = async (studentId: string) => {
    const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
            inscriptions: {
                orderBy: {
                    date: 'desc'
                }
            },
            payments: {
                orderBy: {
                    date: 'desc'
                }
            }
        }
    });

    if (!student) {
        throw new Error('Student not found');
    }

    return student;
};
