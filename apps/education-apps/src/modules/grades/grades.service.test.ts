import prisma from '../../config/database';
import {
    periodsFor,
    listGroupEvaluations,
    createEvaluation,
    updateEvaluation,
    deleteEvaluation,
    saveGrades,
    setPublished,
    bulletin,
    DEFAULT_PERIODS,
} from './grades.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        group: { findFirst: jest.fn() },
        settings: { findUnique: jest.fn() },
        evaluation: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), delete: jest.fn() },
        grade: { findFirst: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
        student: { findMany: jest.fn() },
        $transaction: jest.fn(),
    },
}));

jest.mock('../notifications/dispatcher', () => ({ notifySafely: jest.fn().mockResolvedValue(undefined) }));
import { notifySafely } from '../notifications/dispatcher';

const m = (fn: unknown) => fn as jest.Mock;

const staff = { branchId: 'b1' };
const teacher = { branchId: 'b1', teacherId: 't1' };
const group = {
    id: 'g1',
    branchId: 'b1',
    teacherId: 't1',
    name: 'G Maths',
    subject: 'Maths',
    studentIds: ['s1', 's2'],
    students: [
        { id: 's2', name: 'Ali', surname: 'Zaki' },
        { id: 's1', name: 'Sara', surname: 'Alami' },
    ],
};
const evaluation = { id: 'e1', branchId: 'b1', groupId: 'g1', maxScore: 20, coefficient: 1, published: false };

const validInput = { groupId: 'g1', title: 'Contrôle 1', period: 'Semestre 1', date: '2026-11-10' };

beforeEach(() => {
    jest.clearAllMocks();
    m(prisma.settings.findUnique).mockResolvedValue({ gradingPeriods: [] });
    m(prisma.group.findFirst).mockResolvedValue(group);
    m(prisma.evaluation.findFirst).mockResolvedValue(evaluation);
    m(prisma.$transaction).mockImplementation((ops: unknown) =>
        typeof ops === 'function' ? (ops as (tx: unknown) => unknown)(prisma) : Promise.all(ops as unknown[]),
    );
});

describe('periodsFor', () => {
    it('returns the defaults when the list is empty or settings are missing', async () => {
        expect(await periodsFor('b1')).toEqual(DEFAULT_PERIODS);
        m(prisma.settings.findUnique).mockResolvedValue(null);
        expect(await periodsFor('b1')).toEqual(['Semestre 1', 'Semestre 2']);
    });

    it('returns the branch list when set', async () => {
        m(prisma.settings.findUnique).mockResolvedValue({ gradingPeriods: ['T1', 'T2', 'T3'] });
        expect(await periodsFor('b1')).toEqual(['T1', 'T2', 'T3']);
        expect(prisma.settings.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { branchId: 'b1' } }));
    });
});

describe('scoping', () => {
    it('staff look up the group in their branch only', async () => {
        m(prisma.evaluation.findMany).mockResolvedValue([]);
        await listGroupEvaluations(staff, 'g1');
        expect(prisma.group.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'g1', branchId: 'b1' } }));
    });

    it('a teacher looks up the group in their branch and as its teacher', async () => {
        m(prisma.evaluation.findMany).mockResolvedValue([]);
        await listGroupEvaluations(teacher, 'g1');
        expect(prisma.group.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'g1', branchId: 'b1', teacherId: 't1' } })
        );
    });

    it("a teacher cannot touch another teacher's group or another branch", async () => {
        m(prisma.group.findFirst).mockResolvedValue(null);
        await expect(listGroupEvaluations(teacher, 'g1')).rejects.toThrow('Group not found');
        await expect(createEvaluation(teacher, validInput)).rejects.toThrow('Group not found');
        await expect(saveGrades(teacher, 'e1', [])).rejects.toThrow('Group not found');
        await expect(setPublished(teacher, 'e1', true)).rejects.toThrow('Group not found');
        await expect(deleteEvaluation(teacher, 'e1')).rejects.toThrow('Group not found');
        await expect(updateEvaluation(teacher, 'e1', { title: 'x' })).rejects.toThrow('Group not found');
        expect(prisma.evaluation.create).not.toHaveBeenCalled();
        expect(prisma.evaluation.update).not.toHaveBeenCalled();
        expect(prisma.evaluation.delete).not.toHaveBeenCalled();
        expect(prisma.grade.upsert).not.toHaveBeenCalled();
    });

    it('an evaluation of another branch is not found', async () => {
        m(prisma.evaluation.findFirst).mockResolvedValue(null);
        await expect(setPublished(staff, 'e1', true)).rejects.toThrow('Evaluation not found');
        expect(prisma.evaluation.findFirst).toHaveBeenCalledWith({ where: { id: 'e1', branchId: 'b1' } });
    });

    it('rejects a missing id before querying', async () => {
        await expect(listGroupEvaluations(staff, undefined as any)).rejects.toThrow('groupId is required');
        expect(prisma.group.findFirst).not.toHaveBeenCalled();
    });
});

describe('createEvaluation', () => {
    it('creates with defaults: subject from the group, maxScore 20, coefficient 1', async () => {
        m(prisma.evaluation.create).mockResolvedValue({ id: 'e1' });
        await createEvaluation(teacher, validInput, 'teacher:t1');
        expect(prisma.evaluation.create).toHaveBeenCalledWith({
            data: {
                branchId: 'b1',
                groupId: 'g1',
                title: 'Contrôle 1',
                subject: 'Maths',
                period: 'Semestre 1',
                date: new Date('2026-11-10'),
                maxScore: 20,
                coefficient: 1,
                createdBy: 'teacher:t1',
            },
        });
    });

    it('falls back to the group name when the group has no subject', async () => {
        m(prisma.group.findFirst).mockResolvedValue({ ...group, subject: null });
        m(prisma.evaluation.create).mockResolvedValue({ id: 'e1' });
        await createEvaluation(staff, validInput);
        expect(m(prisma.evaluation.create).mock.calls[0][0].data.subject).toBe('G Maths');
    });

    it.each([
        [{ title: '' }, 'title'],
        [{ title: 'x'.repeat(101) }, 'title'],
        [{ period: 'Trimestre 9' }, 'period'],
        [{ date: 'nope' }, 'date'],
        [{ date: undefined }, 'date'],
        [{ maxScore: 0 }, 'maxScore'],
        [{ maxScore: 101 }, 'maxScore'],
        [{ maxScore: '20' }, 'maxScore'],
        [{ coefficient: 0.05 }, 'coefficient'],
        [{ coefficient: 11 }, 'coefficient'],
    ])('rejects invalid input %o', async (patch, field) => {
        await expect(createEvaluation(staff, { ...validInput, ...patch } as any)).rejects.toThrow(field);
        expect(prisma.evaluation.create).not.toHaveBeenCalled();
    });

    it('accepts a period from the branch list', async () => {
        m(prisma.settings.findUnique).mockResolvedValue({ gradingPeriods: ['Trimestre 1'] });
        m(prisma.evaluation.create).mockResolvedValue({ id: 'e1' });
        await createEvaluation(staff, { ...validInput, period: 'Trimestre 1' });
        expect(prisma.evaluation.create).toHaveBeenCalled();
    });
});

describe('updateEvaluation', () => {
    it('refuses a maxScore below an existing score', async () => {
        m(prisma.grade.findFirst).mockResolvedValue({ id: 'gr1', score: 18 });
        await expect(updateEvaluation(staff, 'e1', { maxScore: 10 })).rejects.toThrow('maxScore');
        expect(prisma.grade.findFirst).toHaveBeenCalledWith({ where: { evaluationId: 'e1', score: { gt: 10 } } });
        expect(prisma.evaluation.update).not.toHaveBeenCalled();
    });

    it('updates only the given, validated fields', async () => {
        m(prisma.grade.findFirst).mockResolvedValue(null);
        m(prisma.evaluation.update).mockResolvedValue({ id: 'e1' });
        await updateEvaluation(staff, 'e1', { title: 'Examen', maxScore: 40, groupId: 'other', branchId: 'x' } as any);
        expect(prisma.evaluation.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { title: 'Examen', maxScore: 40 } });
    });

    it('keeps the current period even if it is no longer in the settings list', async () => {
        m(prisma.evaluation.findFirst).mockResolvedValue({ ...evaluation, period: 'Ancien' });
        m(prisma.evaluation.update).mockResolvedValue({ id: 'e1' });
        await updateEvaluation(staff, 'e1', { period: 'Ancien' });
        expect(prisma.evaluation.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { period: 'Ancien' } });
        await expect(updateEvaluation(staff, 'e1', { period: 'Autre' })).rejects.toThrow('period');
    });

    it('validates fields on update', async () => {
        await expect(updateEvaluation(staff, 'e1', { coefficient: 0 })).rejects.toThrow('coefficient');
    });
});

describe('deleteEvaluation', () => {
    it('deletes the grades with the evaluation', async () => {
        m(prisma.grade.deleteMany).mockReturnValue('del-grades');
        m(prisma.evaluation.delete).mockReturnValue('del-eval');
        await deleteEvaluation(staff, 'e1');
        expect(prisma.grade.deleteMany).toHaveBeenCalledWith({ where: { evaluationId: 'e1' } });
        expect(prisma.evaluation.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
        expect(prisma.$transaction).toHaveBeenCalledWith(['del-grades', 'del-eval']);
    });
});

describe('saveGrades', () => {
    it('upserts every student in one transaction', async () => {
        m(prisma.grade.upsert).mockImplementation((args) => args);
        m(prisma.grade.findMany).mockResolvedValue([{ id: 'x' }]);
        const result = await saveGrades(teacher, 'e1', [
            { studentId: 's1', score: 15.5, absent: false, comment: 'Bien' },
            { studentId: 's2', score: 12, absent: true },
        ]);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.grade.upsert).toHaveBeenCalledWith({
            where: { evaluationId_studentId: { evaluationId: 'e1', studentId: 's1' } },
            create: { branchId: 'b1', evaluationId: 'e1', studentId: 's1', score: 15.5, absent: false, comment: 'Bien' },
            update: { score: 15.5, absent: false, comment: 'Bien' },
        });
        // absent forces score null
        expect(prisma.grade.upsert).toHaveBeenCalledWith({
            where: { evaluationId_studentId: { evaluationId: 'e1', studentId: 's2' } },
            create: { branchId: 'b1', evaluationId: 'e1', studentId: 's2', score: null, absent: true, comment: null },
            update: { score: null, absent: true, comment: null },
        });
        expect(result).toEqual([{ id: 'x' }]);
    });

    it.each([
        [[{ studentId: 's9', score: 10 }], 'not a member'],
        [[{ studentId: 's1', score: 21 }], 'score'],
        [[{ studentId: 's1', score: -1 }], 'score'],
        [[{ studentId: 's1', score: '10' }], 'score'],
        [[{ studentId: 's1', score: 1 }, { studentId: 's1', score: 2 }], 'duplicate'],
        [[{ studentId: 's1', score: 1, comment: 'x'.repeat(501) }], 'comment'],
        [[{ studentId: '', score: 1 }], 'studentId'],
        ['nope', 'grades'],
    ])('rejects %o', async (entries, msg) => {
        await expect(saveGrades(staff, 'e1', entries as any)).rejects.toThrow(msg);
        expect(prisma.grade.upsert).not.toHaveBeenCalled();
    });

    it('accepts null score (not entered yet)', async () => {
        m(prisma.grade.upsert).mockImplementation((args) => args);
        m(prisma.grade.findMany).mockResolvedValue([]);
        await saveGrades(staff, 'e1', [{ studentId: 's1', score: null }]);
        expect(m(prisma.grade.upsert).mock.calls[0][0].update).toEqual({ score: null, absent: false, comment: null });
    });
});

describe('setPublished', () => {
    it('unpublishing does not notify', async () => {
        m(prisma.evaluation.findFirst).mockResolvedValue({ ...evaluation, published: true, notifiedAt: new Date() });
        m(prisma.evaluation.update).mockResolvedValue({ id: 'e1', published: false });
        await setPublished(staff, 'e1', false);
        expect(prisma.evaluation.update).toHaveBeenLastCalledWith({ where: { id: 'e1' }, data: { published: false } });
        expect(notifySafely).not.toHaveBeenCalled();
    });

    it('first publish claims notifiedAt and notifies one message per graded or absent child', async () => {
        m(prisma.evaluation.updateMany).mockResolvedValue({ count: 1 });
        m(prisma.evaluation.findFirst).mockResolvedValue({ ...evaluation, notifiedAt: null });
        m(prisma.evaluation.update).mockResolvedValue({ ...evaluation, subject: 'Maths', title: 'Contrôle 1', published: true });
        m(prisma.grade.findMany).mockResolvedValue([
            { studentId: 's1', score: 15, absent: false },
            { studentId: 's2', score: null, absent: true },
            { studentId: 's3', score: 12, absent: false },
        ]);
        m(prisma.student.findMany).mockResolvedValue([
            { id: 's1', name: 'Amine', surname: 'B', parentId: 'p1' },
            { id: 's2', name: 'Sara', surname: null, parentId: 'p2' },
            { id: 's3', name: 'No', surname: 'Parent', parentId: null },
        ]);
        await setPublished(teacher, 'e1', true);
        expect(prisma.evaluation.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { published: true } });
        expect(prisma.evaluation.updateMany).toHaveBeenCalledWith({
            where: { id: 'e1', OR: [{ notifiedAt: null }, { notifiedAt: { isSet: false } }] },
            data: { notifiedAt: expect.any(Date) },
        });
        expect(prisma.grade.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { evaluationId: 'e1', OR: [{ score: { not: null } }, { absent: true }] },
        }));
        expect(notifySafely).toHaveBeenCalledTimes(2);
        expect(notifySafely).toHaveBeenCalledWith(['p1'], expect.objectContaining({
            kind: 'GRADE',
            branchId: 'b1',
            body: { fr: 'Nouvelle note — Maths · Contrôle 1 : 15/20', ar: 'نقطة جديدة — Maths · Contrôle 1 : 15/20' },
        }));
    });

    it('re-publishing after an unpublish does not notify again', async () => {
        m(prisma.evaluation.findFirst).mockResolvedValue({ ...evaluation, published: false, notifiedAt: new Date() });
        m(prisma.evaluation.update).mockResolvedValue({ id: 'e1', published: true });
        await setPublished(staff, 'e1', true);
        expect(prisma.evaluation.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { published: true } });
        expect(notifySafely).not.toHaveBeenCalled();
        expect(prisma.grade.findMany).not.toHaveBeenCalled();
    });

    it('a concurrent publish that lost the notifiedAt claim does not notify', async () => {
        m(prisma.evaluation.updateMany).mockResolvedValue({ count: 0 });
        m(prisma.evaluation.findFirst).mockResolvedValue({ ...evaluation, notifiedAt: null });
        m(prisma.evaluation.update).mockResolvedValue({ ...evaluation, published: true });
        m(prisma.grade.findMany).mockResolvedValue([{ studentId: 's1', score: 15, absent: false }]);
        m(prisma.student.findMany).mockResolvedValue([{ id: 's1', name: 'A', surname: 'B', parentId: 'p1' }]);
        await setPublished(staff, 'e1', true);
        expect(notifySafely).not.toHaveBeenCalled();
    });

    it('publishing with no grades yet does not stamp notifiedAt', async () => {
        m(prisma.evaluation.findFirst).mockResolvedValue({ ...evaluation, notifiedAt: null });
        m(prisma.evaluation.update).mockResolvedValue({ ...evaluation, published: true });
        m(prisma.grade.findMany).mockResolvedValue([]);
        await setPublished(staff, 'e1', true);
        expect(prisma.evaluation.updateMany).not.toHaveBeenCalled();
        expect(notifySafely).not.toHaveBeenCalled();
    });

    it('requires a boolean', async () => {
        await expect(setPublished(staff, 'e1', 'yes' as any)).rejects.toThrow('published');
    });
});

describe('listGroupEvaluations', () => {
    it('lists the group evaluations with grades, newest first', async () => {
        m(prisma.evaluation.findMany).mockResolvedValue([]);
        await listGroupEvaluations(staff, 'g1');
        expect(prisma.evaluation.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1', groupId: 'g1' },
            include: { grades: true },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        });
    });
});

describe('bulletin', () => {
    it('computes subject averages, general average and rank from published evaluations', async () => {
        m(prisma.evaluation.findMany).mockResolvedValue([
            {
                subject: 'Maths',
                maxScore: 20,
                coefficient: 1,
                published: true,
                grades: [
                    { studentId: 's1', score: 16, absent: false },
                    { studentId: 's2', score: 10, absent: false },
                ],
            },
            {
                subject: 'Physique',
                maxScore: 10,
                coefficient: 2,
                published: true,
                grades: [{ studentId: 's1', score: 5, absent: false }, { studentId: 's2', score: null, absent: true }],
            },
        ]);
        const result = await bulletin(staff, 'g1', 'Semestre 1');
        expect(prisma.evaluation.findMany).toHaveBeenCalledWith({
            where: { branchId: 'b1', groupId: 'g1', period: 'Semestre 1', published: true },
            include: { grades: true },
        });
        expect(result).toEqual({
            groupId: 'g1',
            period: 'Semestre 1',
            subjects: ['Maths', 'Physique'],
            rows: [
                { studentId: 's1', name: 'Sara', surname: 'Alami', averages: { Maths: 16, Physique: 10 }, general: 13, rank: 1 },
                { studentId: 's2', name: 'Ali', surname: 'Zaki', averages: { Maths: 10, Physique: null }, general: 10, rank: 2 },
            ],
        });
    });

    it('requires a known period', async () => {
        m(prisma.evaluation.findFirst).mockResolvedValue(null);
        await expect(bulletin(staff, 'g1', 'X')).rejects.toThrow('period');
    });

    it('accepts a period no longer in settings if the group still has evaluations in it', async () => {
        m(prisma.evaluation.findFirst).mockResolvedValue({ id: 'e1' });
        m(prisma.evaluation.findMany).mockResolvedValue([]);
        const r = await bulletin(staff, 'g1', 'Ancien');
        expect(r.period).toBe('Ancien');
    });
});
