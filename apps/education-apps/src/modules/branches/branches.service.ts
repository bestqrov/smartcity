import prisma from '../../config/database';

export const getBranchesForSchool = async (schoolId: string) => {
    return prisma.branch.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'asc' },
    });
};

export const getBranchSummary = async (schoolId: string) => {
    const branches = await prisma.branch.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'asc' },
    });

    const branchSummaries = await Promise.all(
        branches.map(async (branch) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [studentCount, presentToday, inscriptionTotal, paymentTotal] = await Promise.all([
                prisma.student.count({ where: { branchId: branch.id } }),
                prisma.attendance.count({
                    where: { branchId: branch.id, date: today, status: { in: ['PRESENT', 'LATE'] } },
                }),
                prisma.inscription.aggregate({ where: { branchId: branch.id }, _sum: { amount: true } }),
                prisma.payment.aggregate({ where: { branchId: branch.id }, _sum: { amount: true } }),
            ]);

            const balanceDue = (inscriptionTotal._sum.amount || 0) - (paymentTotal._sum.amount || 0);

            return { branch, studentCount, presentToday, balanceDue };
        })
    );

    const totalStudents = branchSummaries.reduce((sum, b) => sum + b.studentCount, 0);
    const totalBalanceDue = branchSummaries.reduce((sum, b) => sum + b.balanceDue, 0);

    return { branches: branchSummaries, totalStudents, totalBalanceDue };
};
