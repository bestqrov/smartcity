import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { notifySafely } from '../notifications/dispatcher';
import { subjectAverages, generalAverage, rankStudents, MathEvaluation } from './grades.math';

/**
 * Every grades operation runs within a scope: staff get their branch, a teacher (portal link)
 * additionally gets their own id, which limits them to the groups they teach.
 */
export interface GradesScope {
    branchId: string;
    teacherId?: string;
}

export const DEFAULT_PERIODS = ['Semestre 1', 'Semestre 2'];
const MAX_GRADES_PER_BATCH = 500;
const MAX_COMMENT = 500;

export interface EvaluationInput {
    groupId?: string;
    title?: string;
    subject?: string;
    period?: string;
    date?: string | Date;
    maxScore?: number;
    coefficient?: number;
}

export interface GradeEntry {
    studentId: string;
    score?: number | null;
    absent?: boolean;
    comment?: string | null;
}

export const periodsFor = async (branchId: string): Promise<string[]> => {
    const settings = await prisma.settings.findUnique({ where: { branchId }, select: { gradingPeriods: true } });
    const periods = settings?.gradingPeriods ?? [];
    return periods.length > 0 ? periods : [...DEFAULT_PERIODS];
};

const loadGroup = async (scope: GradesScope, groupId: unknown) => {
    assertId('groupId', groupId);
    let group;
    try {
        group = await prisma.group.findFirst({
            where: { id: groupId, branchId: scope.branchId, ...(scope.teacherId && { teacherId: scope.teacherId }) },
            include: { students: { select: { id: true, name: true, surname: true } } },
        });
    } catch {
        group = null; // malformed ObjectId
    }
    if (!group) throw new Error('Group not found');
    return group;
};

const loadEvaluation = async (scope: GradesScope, evaluationId: unknown) => {
    assertId('evaluationId', evaluationId);
    let evaluation;
    try {
        evaluation = await prisma.evaluation.findFirst({ where: { id: evaluationId, branchId: scope.branchId } });
    } catch {
        evaluation = null;
    }
    if (!evaluation) throw new Error('Evaluation not found');
    // Re-check the group against the scope: a teacher only reaches evaluations of their own groups.
    const group = await loadGroup(scope, evaluation.groupId);
    return { evaluation, group };
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates the given fields (all required when `full`), returns clean prisma data. */
const validateFields = async (scope: GradesScope, input: EvaluationInput, full: boolean, currentPeriod?: string) => {
    const data: Record<string, unknown> = {};
    const has = (k: keyof EvaluationInput) => full || input[k] !== undefined;

    if (has('title')) {
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (title.length < 1 || title.length > 100) throw new Error('title must be 1 to 100 characters');
        data.title = title;
    }
    if (input.subject !== undefined) {
        const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
        if (subject.length < 1 || subject.length > 100) throw new Error('subject must be 1 to 100 characters');
        data.subject = subject;
    }
    if (has('period')) {
        // Keeping the evaluation's current period is always fine, even if it was renamed/removed in settings.
        if (!(currentPeriod !== undefined && input.period === currentPeriod)) {
            const periods = await periodsFor(scope.branchId);
            if (typeof input.period !== 'string' || !periods.includes(input.period)) {
                throw new Error(`period must be one of: ${periods.join(', ')}`);
            }
        }
        data.period = input.period;
    }
    if (has('date')) {
        const date = input.date ? new Date(input.date) : null;
        if (!date || Number.isNaN(date.getTime())) throw new Error('date is required and must be valid');
        data.date = date;
    }
    if (input.maxScore !== undefined || full) {
        const maxScore = input.maxScore ?? 20;
        if (!isNum(maxScore) || maxScore < 1 || maxScore > 100) throw new Error('maxScore must be a number between 1 and 100');
        data.maxScore = maxScore;
    }
    if (input.coefficient !== undefined || full) {
        const coefficient = input.coefficient ?? 1;
        if (!isNum(coefficient) || coefficient < 0.1 || coefficient > 10) {
            throw new Error('coefficient must be a number between 0.1 and 10');
        }
        data.coefficient = coefficient;
    }
    return data;
};

export const listGroupEvaluations = async (scope: GradesScope, groupId: string) => {
    await loadGroup(scope, groupId);
    return prisma.evaluation.findMany({
        where: { branchId: scope.branchId, groupId },
        include: { grades: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
};

export const createEvaluation = async (scope: GradesScope, input: EvaluationInput, createdBy?: string) => {
    const group = await loadGroup(scope, input?.groupId);
    const fields = await validateFields(scope, input, true);
    return prisma.evaluation.create({
        data: {
            branchId: scope.branchId,
            groupId: group.id,
            title: fields.title as string,
            subject: (fields.subject as string | undefined) ?? (group.subject || group.name),
            period: fields.period as string,
            date: fields.date as Date,
            maxScore: fields.maxScore as number,
            coefficient: fields.coefficient as number,
            ...(createdBy && { createdBy }),
        },
    });
};

export const updateEvaluation = async (scope: GradesScope, evaluationId: string, input: EvaluationInput) => {
    const { evaluation } = await loadEvaluation(scope, evaluationId);
    const data = await validateFields(scope, input || {}, false, evaluation.period);
    // Check and update atomically so a concurrent grade save cannot slip above the new maxScore.
    return prisma.$transaction(async (tx) => {
        if (data.maxScore !== undefined) {
            const above = await tx.grade.findFirst({ where: { evaluationId, score: { gt: data.maxScore as number } } });
            if (above) throw new Error('maxScore cannot be lower than an existing score');
        }
        return tx.evaluation.update({ where: { id: evaluationId }, data });
    });
};

export const deleteEvaluation = async (scope: GradesScope, evaluationId: string) => {
    await loadEvaluation(scope, evaluationId);
    await prisma.$transaction([
        prisma.grade.deleteMany({ where: { evaluationId } }),
        prisma.evaluation.delete({ where: { id: evaluationId } }),
    ]);
    return { id: evaluationId };
};

export const saveGrades = async (scope: GradesScope, evaluationId: string, entries: GradeEntry[]) => {
    const { evaluation, group } = await loadEvaluation(scope, evaluationId);

    if (!Array.isArray(entries) || entries.length > MAX_GRADES_PER_BATCH) {
        throw new Error(`grades must be an array of at most ${MAX_GRADES_PER_BATCH} entries`);
    }
    const members = new Set(group.studentIds);
    const seen = new Set<string>();
    const clean = entries.map((entry) => {
        const studentId = entry?.studentId;
        if (typeof studentId !== 'string' || !studentId) throw new Error('studentId is required');
        if (seen.has(studentId)) throw new Error('duplicate studentId in grades');
        seen.add(studentId);
        if (!members.has(studentId)) throw new Error('Student is not a member of this group');

        const absent = entry.absent === true;
        let score: number | null = entry.score ?? null;
        if (score !== null && (!isNum(score) || score < 0 || score > evaluation.maxScore)) {
            throw new Error(`score must be a number between 0 and ${evaluation.maxScore}`);
        }
        if (absent) score = null;

        const rawComment = entry.comment ?? null;
        if (rawComment !== null && (typeof rawComment !== 'string' || rawComment.length > MAX_COMMENT)) {
            throw new Error(`comment must be at most ${MAX_COMMENT} characters`);
        }
        const comment = rawComment && rawComment.trim() ? rawComment.trim() : null;
        return { studentId, score, absent, comment };
    });

    await prisma.$transaction(
        clean.map(({ studentId, score, absent, comment }) =>
            prisma.grade.upsert({
                where: { evaluationId_studentId: { evaluationId, studentId } },
                create: { branchId: scope.branchId, evaluationId, studentId, score, absent, comment },
                update: { score, absent, comment },
            })
        )
    );
    return prisma.grade.findMany({ where: { evaluationId } });
};

export const setPublished = async (scope: GradesScope, evaluationId: string, published: boolean) => {
    const { evaluation } = await loadEvaluation(scope, evaluationId);
    if (typeof published !== 'boolean') throw new Error('published must be a boolean');
    // Parents hear about an evaluation once: the first publish stamps notifiedAt, a re-publish doesn't notify.
    const firstPublish = published && !evaluation.published && !evaluation.notifiedAt;
    const updated = await prisma.evaluation.update({
        where: { id: evaluationId },
        data: firstPublish ? { published, notifiedAt: new Date() } : { published },
    });
    if (firstPublish) await notifyGradePublished(updated);
    return updated;
};

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** One message per graded (or absent) child to their parent. Never throws. */
const notifyGradePublished = async (evaluation: {
    id: string; branchId: string; subject: string; title: string; maxScore: number;
}) => {
    try {
        const grades = await prisma.grade.findMany({
            where: { evaluationId: evaluation.id, OR: [{ score: { not: null } }, { absent: true }] },
            select: { studentId: true, score: true, absent: true },
        });
        if (grades.length === 0) return;
        const students = await prisma.student.findMany({
            where: { id: { in: grades.map((g) => g.studentId) } },
            select: { id: true, name: true, surname: true, parentId: true },
        });
        const byId = new Map(students.map((s) => [s.id, s]));
        for (const grade of grades) {
            const student = byId.get(grade.studentId);
            if (!student?.parentId) continue;
            const name = `${student.name} ${student.surname || ''}`.trim();
            const result = grade.absent ? { fr: 'absent(e)', ar: 'غائب(ة)' } : {
                fr: `${fmt(grade.score!)}/${fmt(evaluation.maxScore)}`,
                ar: `${fmt(grade.score!)}/${fmt(evaluation.maxScore)}`,
            };
            await notifySafely([student.parentId], {
                kind: 'GRADE',
                branchId: evaluation.branchId,
                title: { fr: `Nouvelle note — ${name}`, ar: `نقطة جديدة — ${name}` },
                body: {
                    fr: `Nouvelle note — ${evaluation.subject} · ${evaluation.title} : ${result.fr}`,
                    ar: `نقطة جديدة — ${evaluation.subject} · ${evaluation.title} : ${result.ar}`,
                },
            });
        }
    } catch (error) {
        console.error('[grades] failed to notify parents:', error);
    }
};

/** Per-student subject averages, general average and rank for one group and period (published evaluations only). */
export const bulletin = async (scope: GradesScope, groupId: string, period: string) => {
    const group = await loadGroup(scope, groupId);
    const periods = await periodsFor(scope.branchId);
    if (typeof period !== 'string' || !period) throw new Error(`period must be one of: ${periods.join(', ')}`);
    if (!periods.includes(period)) {
        // A renamed/removed period stays valid while evaluations of this group still use it.
        const used = await prisma.evaluation.findFirst({ where: { branchId: scope.branchId, groupId, period } });
        if (!used) throw new Error(`period must be one of: ${periods.join(', ')}`);
    }

    const evaluations = (await prisma.evaluation.findMany({
        where: { branchId: scope.branchId, groupId, period, published: true },
        include: { grades: true },
    })) as unknown as MathEvaluation[];

    const subjects = [...new Set(evaluations.map((e) => e.subject))].sort((a, b) => a.localeCompare(b));
    const students = [...group.students].sort(
        (a, b) => a.surname.localeCompare(b.surname) || a.name.localeCompare(b.name)
    );
    const rows = students.map((s) => {
        const avgs = subjectAverages(evaluations, s.id);
        const averages: Record<string, number | null> = {};
        for (const subject of subjects) averages[subject] = avgs[subject] ?? null;
        return { studentId: s.id, name: s.name, surname: s.surname, averages, general: generalAverage(avgs) };
    });
    const ranks = rankStudents(rows);

    return { groupId, period, subjects, rows: rows.map((r) => ({ ...r, rank: ranks[r.studentId] })) };
};
