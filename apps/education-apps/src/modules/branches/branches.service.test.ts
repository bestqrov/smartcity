import prisma from '../../config/database';
import { getBranchesForSchool, getBranchSummary } from './branches.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findMany: jest.fn() },
        student: { count: jest.fn() },
        attendance: { count: jest.fn() },
        inscription: { aggregate: jest.fn() },
        payment: { aggregate: jest.fn() },
    },
}));

describe('branches.service', () => {
    afterEach(() => jest.clearAllMocks());

    it('getBranchesForSchool scopes by schoolId', async () => {
        (prisma.branch.findMany as jest.Mock).mockResolvedValue([]);

        await getBranchesForSchool('school1');

        expect(prisma.branch.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { schoolId: 'school1' } })
        );
    });

    it('getBranchSummary aggregates student count and balance per branch, plus totals', async () => {
        (prisma.branch.findMany as jest.Mock).mockResolvedValue([
            { id: 'b1', name: 'Branch 1' },
            { id: 'b2', name: 'Branch 2' },
        ]);
        (prisma.student.count as jest.Mock).mockResolvedValueOnce(10).mockResolvedValueOnce(5);
        (prisma.attendance.count as jest.Mock).mockResolvedValue(0);
        (prisma.inscription.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 1000 } });
        (prisma.payment.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 400 } });

        const result = await getBranchSummary('school1');

        expect(result.totalStudents).toBe(15);
        expect(result.totalBalanceDue).toBe(1200); // (1000-400) * 2 branches
        expect(result.branches).toHaveLength(2);
        expect(result.branches[0]).toEqual(
            expect.objectContaining({ studentCount: 10, balanceDue: 600 })
        );
    });
});
