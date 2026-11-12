// src/modules/packs/packs.limits.test.ts
import prisma from '../../config/database';
import { assertStudentCapacity, getSchoolCapacity, StudentLimitError } from './packs.limits';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        branch: { findUnique: jest.fn(), findMany: jest.fn() },
        student: { count: jest.fn() },
    },
}));

const school = (pack: { code: string; name: string; maxStudents: number | null } | null, status = 'ACTIVE') => ({
    school: { id: 'sc1', status, institutionType: 'TUTORING_CENTER', pack },
});

const PRO = { code: 'pro-soutien', name: 'Pro', maxStudents: 300 };

beforeEach(() => {
    jest.clearAllMocks();
    (prisma.branch.findMany as jest.Mock).mockResolvedValue([{ id: 'b1' }, { id: 'b2' }]);
});

describe('getSchoolCapacity', () => {
    it('counts the active students of every branch of the school', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school(PRO));
        (prisma.student.count as jest.Mock).mockResolvedValue(120);

        const capacity = await getSchoolCapacity('b1');

        expect(prisma.branch.findMany).toHaveBeenCalledWith({ where: { schoolId: 'sc1' }, select: { id: true } });
        expect(prisma.student.count).toHaveBeenCalledWith({ where: { active: true, branchId: { in: ['b1', 'b2'] } } });
        expect(capacity).toEqual({
            schoolId: 'sc1',
            status: 'ACTIVE',
            institutionType: 'TUTORING_CENTER',
            packCode: 'pro-soutien',
            packName: 'Pro',
            limit: 300,
            current: 120,
        });
    });

    it('treats a missing institution type as PRIVATE_SCHOOL', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
            school: { id: 'sc1', status: 'ACTIVE', institutionType: null, pack: null },
        });
        (prisma.student.count as jest.Mock).mockResolvedValue(0);
        expect((await getSchoolCapacity('b1')).institutionType).toBe('PRIVATE_SCHOOL');
    });

    it('fails when the branch has no school', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(getSchoolCapacity('b1')).rejects.toThrow('School not found');
    });
});

describe('assertStudentCapacity', () => {
    it('passes while the school stays within its limit, exactly at the limit included', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school(PRO));
        (prisma.student.count as jest.Mock).mockResolvedValue(299);
        await expect(assertStudentCapacity('b1', 1)).resolves.toMatchObject({ current: 299, limit: 300 });
    });

    it('throws StudentLimitError with the numbers when the school would go over', async () => {
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school(PRO));
        (prisma.student.count as jest.Mock).mockResolvedValue(120);

        const error = await assertStudentCapacity('b1', 250).catch((e) => e);

        expect(error).toBeInstanceOf(StudentLimitError);
        expect(error.message).toBe('STUDENT_LIMIT_REACHED');
        expect(error.details).toEqual({ limit: 300, current: 120, adding: 250, packName: 'Pro' });
    });

    it('never blocks an unlimited pack or a school with no pack', async () => {
        (prisma.student.count as jest.Mock).mockResolvedValue(5000);
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school({ code: 'premium', name: 'Premium', maxStudents: null }));
        await expect(assertStudentCapacity('b1', 1000)).resolves.toBeDefined();
        (prisma.branch.findUnique as jest.Mock).mockResolvedValue(school(null));
        await expect(assertStudentCapacity('b1', 1000)).resolves.toBeDefined();
    });
});
