import prisma from '../../config/database';
import { tuitionPayments } from '../payments/tuitionFilter';
import { assertBranchCapacity } from '../packs/packs.limits';

export interface CreateBranchInput {
    name?: unknown;
    city?: unknown;
    address?: unknown;
    phone?: unknown;
}

const optionalText = (value: unknown, max: number, label: string): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string' || value.trim().length > max) throw new Error(`${label} must be at most ${max} characters`);
    return value.trim() || undefined;
};

// Signup creates a school's first branch with only schoolId, name and city (no Settings or other rows:
// they are created lazily with defaults). A branch added later is created the same way, inside a
// transaction that also re-checks the trial and the pack's branch limit.
export const createBranch = async (schoolId: string, input: CreateBranchInput) => {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name.length < 2 || name.length > 80) throw new Error('Name must be 2 to 80 characters');
    const city = optionalText(input.city, 60, 'City') ?? '';
    const address = optionalText(input.address, 200, 'Address');
    const phone = optionalText(input.phone, 30, 'Phone');
    if (phone !== undefined && !/^\+?[0-9 .\-()]{6,20}$/.test(phone)) throw new Error('Invalid phone number');

    return prisma.$transaction(async (tx) => {
        const school = await tx.school.findUnique({ where: { id: schoolId }, select: { status: true, trialEndsAt: true } });
        if (!school) throw new Error('School not found');
        // Same rule as tenantScope for writes.
        if (school.status === 'PENDING' && school.trialEndsAt && new Date() > school.trialEndsAt) {
            throw new Error('TRIAL_EXPIRED');
        }
        await assertBranchCapacity(schoolId, 1, tx);
        return tx.branch.create({
            data: { schoolId, name, city, ...(address ? { address } : {}), ...(phone ? { phone } : {}) },
        });
    });
};

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
                // A student can attend several sessions a day: count students, not records.
                prisma.attendance
                    .findMany({
                        where: { branchId: branch.id, date: today, status: { in: ['PRESENT', 'LATE'] } },
                        distinct: ['studentId'],
                        select: { studentId: true },
                    })
                    .then((rows) => rows.length),
                prisma.inscription.aggregate({ where: { branchId: branch.id }, _sum: { amount: true } }),
                prisma.payment.aggregate({ where: { branchId: branch.id, ...tuitionPayments.where }, _sum: { amount: true } }),
            ]);

            const balanceDue = (inscriptionTotal._sum.amount || 0) - (paymentTotal._sum.amount || 0);

            return { branch, studentCount, presentToday, balanceDue };
        })
    );

    const totalStudents = branchSummaries.reduce((sum, b) => sum + b.studentCount, 0);
    const totalBalanceDue = branchSummaries.reduce((sum, b) => sum + b.balanceDue, 0);

    return { branches: branchSummaries, totalStudents, totalBalanceDue };
};
