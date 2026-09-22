import prisma from '../../config/database';
import { tuitionPayments } from '../payments/tuitionFilter';

export const getStudentsForDocuments = async (branchId: string) => {
    const students = await prisma.student.findMany({
        where: { branchId },
        include: {
            inscriptions: {
                orderBy: {
                    date: 'desc'
                }
            },
            payments: {
                ...tuitionPayments,
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

export const getStudentDocument = async (studentId: string, branchId: string) => {
    const student = await prisma.student.findFirst({
        where: { id: studentId, branchId },
        include: {
            inscriptions: {
                orderBy: {
                    date: 'desc'
                }
            },
            payments: {
                ...tuitionPayments,
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
