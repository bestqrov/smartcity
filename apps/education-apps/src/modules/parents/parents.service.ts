import { isTargeted } from '../activities/activities.service';
import prisma from '../../config/database';
import { generateRawToken, hashToken } from '../../utils/accessToken';
import { tuitionPayments } from '../payments/tuitionFilter';
import { currentMonth } from '../transport/month';
import { periodsFor, DEFAULT_PERIODS } from '../grades/grades.service';

export interface CreateParentData {
    name: string;
    phone: string;
    whatsapp?: string;
    email?: string;
    cin?: string;
    address?: string;
}

// Every staff-side parent operation is limited to the caller's branch: a parent's access link
// opens their children's attendance, payments and transport details, so another school must
// never be able to list, edit or re-issue it.

export const createParent = async (data: CreateParentData & { branchId: string }) => {
    const rawToken = generateRawToken();

    const parent = await prisma.parent.create({
        data: {
            ...data,
            accessTokenHash: hashToken(rawToken),
            linkIssuedAt: new Date(),
        },
    });

    return { parent, rawToken };
};

export const getAllParents = async (branchId: string) => {
    return prisma.parent.findMany({
        where: { branchId },
        include: { students: { where: { branchId } } },
        orderBy: { createdAt: 'desc' },
    });
};

const findOwnParent = async (id: string, branchId: string) => {
    let parent;
    try {
        parent = await prisma.parent.findFirst({
            where: { id, branchId },
            include: { students: { where: { branchId } } },
        });
    } catch {
        parent = null; // malformed ObjectId
    }

    if (!parent) {
        throw new Error('Parent not found');
    }

    return parent;
};

export const getParentById = async (id: string, branchId: string) => findOwnParent(id, branchId);

export const updateParent = async (id: string, branchId: string, data: Partial<CreateParentData>) => {
    await findOwnParent(id, branchId);
    const { name, phone, whatsapp, email, cin, address } = data;
    return prisma.parent.update({ where: { id }, data: { name, phone, whatsapp, email, cin, address } });
};

export const regenerateParentToken = async (id: string, branchId: string) => {
    await findOwnParent(id, branchId);
    const rawToken = generateRawToken();

    const parent = await prisma.parent.update({
        where: { id },
        data: { accessTokenHash: hashToken(rawToken), linkIssuedAt: new Date() },
    });

    return { parent, rawToken };
};

/** Throws unless the parent exists in this branch — used before linking a student to it. */
export const assertParentInBranch = async (parentId: string | null | undefined, branchId: string) => {
    if (!parentId) return;
    await findOwnParent(parentId, branchId);
};

interface ParentGrade {
    evaluationId: string;
    title: string;
    subject: string;
    period: string;
    date: Date;
    maxScore: number;
    coefficient: number;
    score: number | null;
    absent: boolean;
    comment: string | null;
}

const PROFILE_ATTENDANCE_DAYS = 60;
const PROFILE_ACTIVITY_PAST_DAYS = 30;
const PROFILE_HOMEWORK_PAST_DAYS = 14;
const PROFILE_HOMEWORK_AHEAD_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LINKS_PER_REQUEST = 200;

export const getParentByRawToken = async (rawToken: string) => {
    const accessTokenHash = hashToken(rawToken);
    const attendanceSince = new Date(Date.now() - PROFILE_ATTENDANCE_DAYS * 24 * 60 * 60 * 1000);

    const parent = await prisma.parent.findUnique({
        where: { accessTokenHash },
        include: {
            students: {
                include: {
                    inscriptions: true,
                    payments: tuitionPayments,
                    attendances: {
                        where: { date: { gte: attendanceSince } },
                        select: { id: true, date: true, slotStart: true, status: true, groupId: true, scannedAt: true },
                        orderBy: [{ date: 'desc' }, { slotStart: 'desc' }],
                    },
                    // Only what a parent needs: the teacher is reduced to a name.
                    groups: {
                        select: { id: true, name: true, subject: true, level: true, timeSlots: true, teacher: { select: { name: true } } },
                    },
                    // Read-only transport summary for the portal: route/stop/subscription scalars are returned; driver is limited to name+phone, vehicle to plate, payments to id.
                    transportSubscriptions: {
                        where: { status: { in: ['ACTIVE', 'PAUSED'] } },
                        include: {
                            route: {
                                include: {
                                    driver: { select: { name: true, phone: true } },
                                    vehicle: { select: { plate: true } },
                                },
                            },
                            stop: true,
                            payments: { where: { forMonth: currentMonth() }, select: { id: true } },
                        },
                    },
                },
            },
        },
    });

    if (!parent) return null;

    if (!parent.branchId) {
        return {
            ...parent,
            students: parent.students.map((s) => ({ ...s, grades: [], homework: [] })),
            announcements: [],
            holidays: [],
            activities: [],
            school: null,
            gradingPeriods: [...DEFAULT_PERIODS],
        };
    }

    // Defence in depth: never expose a linked student that belongs to another branch.
    parent.students = parent.students.filter((s) => s.branchId === parent.branchId);

    const branchId = parent.branchId;
    const studentIds = parent.students.map((s) => s.id);
    const now = Date.now();
    const activeChildren = parent.students.filter((s) => s.active !== false);
    const childGroupIds = [...new Set(parent.students.flatMap((s) => s.groupIds ?? []))];
    const [announcements, holidays, branch, gradingPeriods, grades, activityRows, homeworkRows] = await Promise.all([
        prisma.announcement.findMany({
            where: { branchId, active: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
        }),
        prisma.holiday.findMany({
            where: { branchId, active: true, endDate: { gte: new Date() } },
            orderBy: { startDate: 'asc' },
        }),
        prisma.branch.findUnique({
            where: { id: branchId },
            include: { school: { select: { name: true, logo: true, phone: true, email: true } } },
        }),
        periodsFor(branchId),
        // Only grades of published evaluations ever reach parents.
        studentIds.length === 0
            ? Promise.resolve([])
            : prisma.grade.findMany({
                  where: {
                      branchId,
                      studentId: { in: studentIds },
                      evaluation: { is: { published: true, branchId } },
                      // A cleared grade (no score, not absent) is not a grade.
                      OR: [{ absent: true }, { score: { not: null } }],
                  },
                  include: { evaluation: true },
              }),
        activeChildren.length === 0
            ? Promise.resolve([])
            : prisma.activity.findMany({
                  where: { branchId, published: true, startAt: { gte: new Date(now - PROFILE_ACTIVITY_PAST_DAYS * DAY_MS) } },
                  orderBy: { startAt: 'asc' },
                  select: {
                      id: true,
                      title: true,
                      description: true,
                      startAt: true,
                      endAt: true,
                      location: true,
                      price: true,
                      needsConsent: true,
                      deadline: true,
                      coverImage: true,
                      audience: true,
                      groupIds: true,
                  },
              }),
        childGroupIds.length === 0
            ? Promise.resolve([])
            : prisma.homework.findMany({
                  where: {
                      branchId,
                      groupId: { in: childGroupIds },
                      dueDate: { gte: new Date(now - PROFILE_HOMEWORK_PAST_DAYS * DAY_MS), lte: new Date(now + PROFILE_HOMEWORK_AHEAD_DAYS * DAY_MS) },
                  },
                  orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
                  select: { id: true, groupId: true, subject: true, title: true, details: true, dueDate: true },
              }),
    ]);

    // Activities: only those whose audience includes at least one (active) child, with each targeted child's answer.
    const visibleActivities = activityRows
        .map((a) => ({ a, children: activeChildren.filter((s) => isTargeted(a, s)) }))
        .filter(({ children }) => children.length > 0);
    const responses =
        visibleActivities.length === 0
            ? []
            : await prisma.activityResponse.findMany({
                  where: { branchId, activityId: { in: visibleActivities.map(({ a }) => a.id) }, studentId: { in: activeChildren.map((s) => s.id) } },
                  select: { activityId: true, studentId: true, answer: true, paid: true },
              });
    const activities = visibleActivities.map(({ a, children }) => {
        const { audience: _audience, groupIds: _groupIds, ...fields } = a;
        return {
            ...fields,
            children: children.map((s) => {
                const r = responses.find((x) => x.activityId === a.id && x.studentId === s.id);
                return { studentId: s.id, answer: r?.answer ?? null, paid: r?.paid ?? false };
            }),
        };
    });

    const gradesByStudent = new Map<string, ParentGrade[]>();
    for (const g of grades) {
        const ev = g.evaluation;
        if (!ev || ev.published !== true || ev.branchId !== branchId) continue; // defence in depth
        if (!g.absent && g.score == null) continue;
        const list = gradesByStudent.get(g.studentId) ?? [];
        list.push({
            evaluationId: ev.id,
            title: ev.title,
            subject: ev.subject,
            period: ev.period,
            date: ev.date,
            maxScore: ev.maxScore,
            coefficient: ev.coefficient,
            score: g.score,
            absent: g.absent,
            comment: g.comment,
        });
        gradesByStudent.set(g.studentId, list);
    }
    const students = parent.students.map((s) => ({
        ...s,
        grades: (gradesByStudent.get(s.id) ?? []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        homework: homeworkRows
            .filter((h) => (s.groupIds ?? []).includes(h.groupId))
            .map(({ groupId, ...h }) => ({ ...h, groupName: s.groups.find((g) => g.id === groupId)?.name ?? null })),
    }));

    return { ...parent, students, announcements, holidays, activities, school: branch?.school || null, gradingPeriods };
};

/** Re-issues the access link of many parents at once (bulk QR cards). All-or-nothing, branch-scoped. */
export const issueParentLinks = async (parentIds: unknown, branchId: string) => {
    if (
        !Array.isArray(parentIds) ||
        parentIds.length < 1 ||
        parentIds.length > MAX_LINKS_PER_REQUEST ||
        parentIds.some((id) => typeof id !== 'string' || id.length === 0) ||
        new Set(parentIds).size !== parentIds.length
    ) {
        throw new Error(`parentIds must be 1 to ${MAX_LINKS_PER_REQUEST} distinct non-empty ids`);
    }
    const ids = parentIds as string[];

    let found: { id: string }[];
    try {
        found = await prisma.parent.findMany({ where: { id: { in: ids }, branchId }, select: { id: true } });
    } catch {
        found = []; // malformed ObjectId
    }
    if (found.length !== ids.length) {
        throw new Error('Parent not found');
    }

    const issuedAt = new Date();
    const links = ids.map((id) => ({ id, rawToken: generateRawToken() }));
    await prisma.$transaction(
        links.map(({ id, rawToken }) =>
            prisma.parent.update({ where: { id }, data: { accessTokenHash: hashToken(rawToken), linkIssuedAt: issuedAt } })
        )
    );

    return links;
};

/** The branch's parents with link status and last visit, for the "Accès parents" page. */
export const getParentsAccess = async (branchId: string) => {
    const parents = await prisma.parent.findMany({
        where: { branchId },
        select: {
            id: true,
            name: true,
            phone: true,
            whatsapp: true,
            linkIssuedAt: true,
            students: { where: { branchId }, select: { id: true, name: true, surname: true } },
        },
    });
    if (parents.length === 0) return [];

    const visits = await prisma.accessLog.groupBy({
        by: ['parentId'],
        where: { parentId: { in: parents.map((p) => p.id) } },
        _max: { accessedAt: true },
    });
    const lastVisit = new Map(visits.map((v) => [v.parentId, v._max.accessedAt]));

    return parents
        .map(({ students, ...parent }) => ({ ...parent, lastVisitAt: lastVisit.get(parent.id) ?? null, children: students }))
        .sort((a, b) => a.name.localeCompare(b.name));
};
