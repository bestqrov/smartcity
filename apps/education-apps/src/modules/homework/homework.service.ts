import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { notifySafely } from '../notifications/dispatcher';

/** Same scope as grades: staff get their branch, a teacher (portal link) is limited to their own groups. */
export interface HomeworkScope {
    branchId: string;
    teacherId?: string;
}

export interface HomeworkInput {
    groupId?: string;
    subject?: string;
    title?: string;
    details?: string | null;
    dueDate?: string | Date;
}

const MAX_TITLE = 150;
const MAX_DETAILS = 2000;
const MAX_SUBJECT = 100;

const loadGroup = async (scope: HomeworkScope, groupId: unknown) => {
    assertId('groupId', groupId);
    let group;
    try {
        group = await prisma.group.findFirst({
            where: { id: groupId, branchId: scope.branchId, ...(scope.teacherId && { teacherId: scope.teacherId }) },
            select: { id: true, name: true, subject: true, studentIds: true },
        });
    } catch {
        group = null;
    }
    if (!group) throw new Error('Group not found');
    return group;
};

const loadHomework = async (scope: HomeworkScope, id: unknown) => {
    assertId('homeworkId', id);
    let homework;
    try {
        homework = await prisma.homework.findFirst({ where: { id, branchId: scope.branchId } });
    } catch {
        homework = null;
    }
    if (!homework) throw new Error('Homework not found');
    await loadGroup(scope, homework.groupId); // a teacher only reaches homework of their own groups
    return homework;
};

const validate = (input: HomeworkInput, full: boolean) => {
    const data: Record<string, unknown> = {};
    if (full || input.title !== undefined) {
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (title.length < 1 || title.length > MAX_TITLE) throw new Error(`title must be 1 to ${MAX_TITLE} characters`);
        data.title = title;
    }
    if (input.subject !== undefined && input.subject !== null && input.subject !== '') {
        const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
        if (subject.length < 1 || subject.length > MAX_SUBJECT) throw new Error(`subject must be 1 to ${MAX_SUBJECT} characters`);
        data.subject = subject;
    }
    if (input.details !== undefined) {
        if (input.details === null || input.details === '') data.details = null;
        else {
            if (typeof input.details !== 'string') throw new Error('details must be a string');
            const details = input.details.trim();
            if (details.length > MAX_DETAILS) throw new Error(`details must be at most ${MAX_DETAILS} characters`);
            data.details = details || null;
        }
    }
    if (full || input.dueDate !== undefined) {
        const due = input.dueDate ? new Date(input.dueDate) : null;
        if (!due || Number.isNaN(due.getTime())) throw new Error('dueDate is required and must be valid');
        data.dueDate = due;
    }
    return data;
};

const formatDate = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
};

export const listGroupHomework = async (scope: HomeworkScope, groupId: unknown) => {
    const group = await loadGroup(scope, groupId);
    return prisma.homework.findMany({
        where: { branchId: scope.branchId, groupId: group.id },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
};

export const createHomework = async (scope: HomeworkScope, input: HomeworkInput, createdBy?: string) => {
    const group = await loadGroup(scope, input?.groupId);
    const fields = validate(input || {}, true);
    const homework = await prisma.homework.create({
        data: {
            branchId: scope.branchId,
            groupId: group.id,
            subject: (fields.subject as string | undefined) ?? (group.subject || group.name),
            title: fields.title as string,
            details: (fields.details as string | null | undefined) ?? null,
            dueDate: fields.dueDate as Date,
            ...(createdBy && { createdBy }),
        },
    });

    try {
        const students =
            group.studentIds.length === 0
                ? []
                : await prisma.student.findMany({
                      where: { id: { in: group.studentIds }, branchId: scope.branchId, active: true },
                      select: { parentId: true },
                  });
        const date = formatDate(homework.dueDate);
        await notifySafely(
            students.map((s) => s.parentId).filter((id): id is string => !!id),
            {
                kind: 'HOMEWORK',
                branchId: scope.branchId,
                title: { fr: 'Devoir', ar: 'واجب منزلي' },
                body: {
                    fr: `Devoir — ${homework.subject} : ${homework.title} (pour le ${date})`,
                    ar: `واجب — ${homework.subject} : ${homework.title} (ليوم ${date})`,
                },
            }
        );
    } catch (error) {
        console.error('[homework] failed to notify parents:', error);
    }
    return homework;
};

export const updateHomework = async (scope: HomeworkScope, id: unknown, input: HomeworkInput) => {
    const homework = await loadHomework(scope, id);
    const { groupId: _ignored, ...rest } = input || {};
    const data = validate(rest, false);
    return prisma.homework.update({ where: { id: homework.id }, data });
};

export const deleteHomework = async (scope: HomeworkScope, id: unknown) => {
    const homework = await loadHomework(scope, id);
    await prisma.homework.delete({ where: { id: homework.id } });
    return { id: homework.id };
};
