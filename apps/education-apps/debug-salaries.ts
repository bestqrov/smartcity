
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function calculateMonthlyTeacherExpenses() {
    console.log('--- Debugging Teacher Salaries ---');

    // Get all teachers with their groups
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

    console.log(`Found ${teachers.length} teachers.`);

    let totalExpenses = 0;

    for (const teacher of teachers) {
        let teacherExpense = 0;
        // Using 'name' only as surname might not exist in schema or is named 'lastName'
        console.log(`Teacher: ${teacher.name} (${teacher.paymentType})`);

        if (teacher.paymentType === 'FIXED') {
            teacherExpense = teacher.hourlyRate || 0;
            console.log(`- Type: FIXED, Rate: ${teacher.hourlyRate}, Expense: ${teacherExpense}`);
        } else if (teacher.paymentType === 'HOURLY') {
            const totalHours = teacher.groups.length * 8;
            teacherExpense = totalHours * (teacher.hourlyRate || 0);
            console.log(`- Type: HOURLY, Groups: ${teacher.groups.length}, Rate: ${teacher.hourlyRate}, Hours: ${totalHours}, Expense: ${teacherExpense}`);
        } else if (teacher.paymentType === 'PERCENTAGE') {
            const totalStudents = teacher.groups.reduce((sum, group) => sum + group._count.students, 0);
            const estimatedRevenue = totalStudents * 500;
            teacherExpense = estimatedRevenue * ((teacher.commission || 0) / 100);
            console.log(`- Type: PERCENTAGE, Students: ${totalStudents}, Commission: ${teacher.commission}%, Expense: ${teacherExpense}`);
        } else {
            console.log(`- Type: UNKNOWN (${teacher.paymentType}), Expense: 0`);
        }

        totalExpenses += teacherExpense;
    }

    console.log(`\nTotal Calculated Expenses: ${totalExpenses}`);
    return totalExpenses;
}

async function main() {
    try {
        await calculateMonthlyTeacherExpenses();
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
