import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';
import { findTeacherByToken, getTeacherPortal } from './teacherPortal.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        teacher: { findFirst: jest.fn() },
        group: { findMany: jest.fn() },
        evaluation: { findMany: jest.fn() },
        settings: { findUnique: jest.fn() },
        branch: { findUnique: jest.fn() },
    },
}));

const m = (fn: unknown) => fn as jest.Mock;

describe('findTeacherByToken', () => {
    afterEach(() => jest.clearAllMocks());

    it('looks the teacher up by the hash of the token', async () => {
        m(prisma.teacher.findFirst).mockResolvedValue({ id: 't1', name: 'Prof', branchId: 'b1' });
        const teacher = await findTeacherByToken('raw');
        expect(prisma.teacher.findFirst).toHaveBeenCalledWith({
            where: { accessTokenHash: hashToken('raw') },
            select: { id: true, name: true, branchId: true },
        });
        expect(teacher).toEqual({ id: 't1', name: 'Prof', branchId: 'b1' });
    });

    it('returns null for an empty or unknown token without leaking errors', async () => {
        expect(await findTeacherByToken('')).toBeNull();
        expect(await findTeacherByToken(undefined as any)).toBeNull();
        expect(prisma.teacher.findFirst).not.toHaveBeenCalled();
        m(prisma.teacher.findFirst).mockResolvedValue(null);
        expect(await findTeacherByToken('nope')).toBeNull();
    });
});

describe('getTeacherPortal', () => {
    afterEach(() => jest.clearAllMocks());

    it("returns only the teacher's groups in their branch, with sorted students, evaluations and periods", async () => {
        m(prisma.group.findMany).mockResolvedValue([
            {
                id: 'g1',
                name: 'Maths 2BAC',
                subject: 'Maths',
                level: 'LYCEE',
                type: 'SOUTIEN',
                students: [
                    { id: 's2', name: 'Ali', surname: 'Zaki' },
                    { id: 's1', name: 'Sara', surname: 'Alami' },
                ],
            },
        ]);
        const ev = { id: 'e1', groupId: 'g1', title: 'C1', grades: [] };
        m(prisma.evaluation.findMany).mockResolvedValue([ev]);
        m(prisma.settings.findUnique).mockResolvedValue({ gradingPeriods: [] });
        m(prisma.branch.findUnique).mockResolvedValue({ school: { name: 'Ecole', logo: null } });

        const result = await getTeacherPortal({ id: 't1', name: 'Prof', branchId: 'b1' });

        expect(prisma.group.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teacherId: 't1', branchId: 'b1' } })
        );
        expect(prisma.evaluation.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1', groupId: { in: ['g1'] } },
            include: { grades: true },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        });
        expect(result).toEqual({
            teacher: { id: 't1', name: 'Prof' },
            school: { name: 'Ecole', logo: null },
            periods: ['Semestre 1', 'Semestre 2'],
            groups: [
                {
                    id: 'g1',
                    name: 'Maths 2BAC',
                    subject: 'Maths',
                    level: 'LYCEE',
                    type: 'SOUTIEN',
                    students: [
                        { id: 's1', name: 'Sara', surname: 'Alami' },
                        { id: 's2', name: 'Ali', surname: 'Zaki' },
                    ],
                    evaluations: [ev],
                },
            ],
        });
    });

    it('skips the evaluation query when the teacher has no group', async () => {
        m(prisma.group.findMany).mockResolvedValue([]);
        m(prisma.settings.findUnique).mockResolvedValue(null);
        m(prisma.branch.findUnique).mockResolvedValue(null);
        const result = await getTeacherPortal({ id: 't1', name: 'Prof', branchId: 'b1' });
        expect(prisma.evaluation.findMany).not.toHaveBeenCalled();
        expect(result.groups).toEqual([]);
        expect(result.school).toBeNull();
    });
});
