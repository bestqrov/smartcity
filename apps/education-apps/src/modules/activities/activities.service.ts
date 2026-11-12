import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { hashToken } from '../../utils/accessToken';
import { notifySafely } from '../notifications/dispatcher';

export interface ActivityInput {
    title?: string;
    description?: string | null;
    startAt?: string | Date;
    endAt?: string | Date | null;
    location?: string | null;
    price?: number | null;
    needsConsent?: boolean;
    deadline?: string | Date | null;
    audience?: string;
    groupIds?: string[];
    coverImage?: string | null;
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_LOCATION = 200;
const MAX_NOTE = 500;
const MAX_COVER_LENGTH = 1.4 * 1024 * 1024;
const COVER_RE = /^data:image\/(jpeg|png|webp);base64,/;
const DAY = 24 * 60 * 60 * 1000;

/** Minimal shape needed to resolve who an activity targets. */
export interface AudienceActivity {
    audience: string;
    groupIds: string[];
}

/** Does this student (with their group ids) belong to the activity's audience? */
export const isTargeted = (activity: AudienceActivity, student: { groupIds?: string[] | null }) =>
    activity.audience !== 'GROUPS' || (student.groupIds ?? []).some((g) => activity.groupIds.includes(g));

/** Active students of the branch targeted by the activity (ALL → every active student; GROUPS → members of those groups). */
export const targetedStudents = async (branchId: string, activity: AudienceActivity) => {
    if (activity.audience === 'GROUPS' && activity.groupIds.length === 0) return [];
    return prisma.student.findMany({
        where: {
            branchId,
            active: true,
            ...(activity.audience === 'GROUPS' && { groupIds: { hasSome: activity.groupIds } }),
        },
        select: { id: true, name: true, surname: true, parentId: true, groupIds: true },
        orderBy: [{ surname: 'asc' }, { name: 'asc' }],
    });
};

const loadActivity = async (branchId: string, id: unknown) => {
    assertId('activityId', id);
    let activity;
    try {
        activity = await prisma.activity.findFirst({ where: { id, branchId } });
    } catch {
        activity = null;
    }
    if (!activity) throw new Error('Activity not found');
    return activity;
};

const optionalText = (label: string, value: unknown, max: number) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') throw new Error(`${label} must be a string`);
    const text = value.trim();
    if (text.length > max) throw new Error(`${label} must be at most ${max} characters`);
    return text || null;
};

const optionalDate = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return null;
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) throw new Error(`${label} must be a valid date`);
    return d;
};

/** Validates the given fields (all required ones when `full`), with cross-field checks on the merged result. */
const validate = async (branchId: string, input: ActivityInput, current?: Record<string, any>) => {
    const full = !current;
    const data: Record<string, unknown> = {};
    const has = (k: keyof ActivityInput) => input[k] !== undefined;

    if (full || has('title')) {
        const title = typeof input.title === 'string' ? input.title.trim() : '';
        if (title.length < 1 || title.length > MAX_TITLE) throw new Error(`title must be 1 to ${MAX_TITLE} characters`);
        data.title = title;
    }
    if (has('description')) data.description = optionalText('description', input.description, MAX_DESCRIPTION);
    if (has('location')) data.location = optionalText('location', input.location, MAX_LOCATION);
    if (full || has('startAt')) {
        const startAt = optionalDate('startAt', input.startAt);
        if (!startAt) throw new Error('startAt is required and must be valid');
        data.startAt = startAt;
    }
    if (has('endAt')) data.endAt = optionalDate('endAt', input.endAt);
    if (has('deadline')) data.deadline = optionalDate('deadline', input.deadline);
    if (has('price')) {
        if (input.price === null) data.price = null;
        else {
            if (typeof input.price !== 'number' || !Number.isFinite(input.price) || input.price < 0) {
                throw new Error('price must be a number ≥ 0');
            }
            data.price = input.price;
        }
    }
    if (has('needsConsent')) {
        if (typeof input.needsConsent !== 'boolean') throw new Error('needsConsent must be a boolean');
        data.needsConsent = input.needsConsent;
    }
    if (has('coverImage')) {
        if (input.coverImage === null || input.coverImage === '') data.coverImage = null;
        else {
            if (typeof input.coverImage !== 'string' || !COVER_RE.test(input.coverImage)) {
                throw new Error('coverImage must be a JPEG, PNG or WebP data URL');
            }
            if (input.coverImage.length > MAX_COVER_LENGTH) throw new Error('coverImage is too large');
            data.coverImage = input.coverImage;
        }
    }
    if (full || has('audience') || has('groupIds')) {
        const audience = input.audience ?? current?.audience ?? 'ALL';
        if (audience !== 'ALL' && audience !== 'GROUPS') throw new Error('audience must be ALL or GROUPS');
        data.audience = audience;
        if (audience === 'ALL') data.groupIds = [];
        else {
            const raw = input.groupIds ?? current?.groupIds ?? [];
            if (!Array.isArray(raw) || raw.some((g) => typeof g !== 'string' || !g)) throw new Error('groupIds must be a list of ids');
            const ids = [...new Set(raw as string[])];
            if (ids.length === 0) throw new Error('groupIds is required when audience is GROUPS');
            let found: { id: string }[] = [];
            try {
                found = await prisma.group.findMany({ where: { id: { in: ids }, branchId }, select: { id: true } });
            } catch {
                found = [];
            }
            if (found.length !== ids.length) throw new Error('Group not found');
            data.groupIds = ids;
        }
    }

    const merged = { ...(current ?? {}), ...data };
    if (merged.endAt && merged.startAt && new Date(merged.endAt) < new Date(merged.startAt)) {
        throw new Error('endAt must be after startAt');
    }
    if (merged.deadline && merged.startAt && new Date(merged.deadline) > new Date(merged.startAt)) {
        throw new Error('deadline must not be after startAt');
    }
    return data;
};

const formatDate = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
};

const notifyParents = async (branchId: string, activity: { title: string; startAt: Date }, parentIds: (string | null)[], reminder: boolean) => {
    const date = formatDate(new Date(activity.startAt));
    await notifySafely(
        parentIds.filter((id): id is string => !!id),
        {
            kind: 'ACTIVITY',
            branchId,
            title: reminder ? { fr: 'Rappel activité', ar: 'تذكير بنشاط' } : { fr: 'Nouvelle activité', ar: 'نشاط جديد' },
            body: reminder
                ? { fr: `${activity.title} (le ${date}) : merci de répondre.`, ar: `${activity.title} (يوم ${date}) : المرجو الرد.` }
                : { fr: `${activity.title} (le ${date})`, ar: `${activity.title} (يوم ${date})` },
        }
    );
};

export const listActivities = async (branchId: string) => {
    const activities = await prisma.activity.findMany({ where: { branchId }, orderBy: { startAt: 'desc' } });
    if (activities.length === 0) return [];
    const [students, responses] = await Promise.all([
        prisma.student.findMany({ where: { branchId, active: true }, select: { id: true, groupIds: true } }),
        prisma.activityResponse.findMany({
            where: { branchId, activityId: { in: activities.map((a) => a.id) } },
            select: { activityId: true, studentId: true, answer: true, paid: true },
        }),
    ]);
    return activities.map((a) => {
        const targeted = new Set(students.filter((s) => isTargeted(a, s)).map((s) => s.id));
        const own = responses.filter((r) => r.activityId === a.id && targeted.has(r.studentId));
        const yes = own.filter((r) => r.answer === 'YES').length;
        const no = own.filter((r) => r.answer === 'NO').length;
        return {
            ...a,
            counts: { targeted: targeted.size, yes, no, noAnswer: targeted.size - yes - no, paid: own.filter((r) => r.paid).length },
        };
    });
};

export const createActivity = async (branchId: string, input: ActivityInput) => {
    const data = await validate(branchId, input || {});
    return prisma.activity.create({ data: { ...(data as any), branchId, published: false } });
};

export const updateActivity = async (branchId: string, id: unknown, input: ActivityInput) => {
    const activity = await loadActivity(branchId, id);
    const data = await validate(branchId, input || {}, activity);
    return prisma.activity.update({ where: { id: activity.id }, data });
};

export const deleteActivity = async (branchId: string, id: unknown) => {
    const activity = await loadActivity(branchId, id);
    await prisma.activityResponse.deleteMany({ where: { activityId: activity.id } });
    await prisma.activity.delete({ where: { id: activity.id } });
    return { id: activity.id };
};

/** Publishing makes it visible to parents; the first publish notifies them, exactly once (atomic notifiedAt claim). */
export const setPublished = async (branchId: string, id: unknown, published: unknown) => {
    if (typeof published !== 'boolean') throw new Error('published must be a boolean');
    const activity = await loadActivity(branchId, id);
    const updated = await prisma.activity.update({ where: { id: activity.id }, data: { published } });
    if (published && !activity.notifiedAt) {
        try {
            const claim = await prisma.activity.updateMany({ where: { id: activity.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
            if (claim.count === 1) {
                const students = await targetedStudents(branchId, activity);
                await notifyParents(branchId, activity, students.map((s) => s.parentId), false);
            }
        } catch (error) {
            console.error('[activities] failed to notify parents:', error);
        }
    }
    return updated;
};

export const listResponses = async (branchId: string, id: unknown) => {
    const activity = await loadActivity(branchId, id);
    const students = await targetedStudents(branchId, activity);
    const ids = students.map((s) => s.id);
    const [responses, parents] = await Promise.all([
        prisma.activityResponse.findMany({ where: { activityId: activity.id, branchId } }),
        prisma.parent.findMany({
            where: { id: { in: [...new Set(students.map((s) => s.parentId).filter((p): p is string => !!p))] } },
            select: { id: true, name: true, phone: true },
        }),
    ]);
    const byStudent = new Map(responses.filter((r) => ids.includes(r.studentId)).map((r) => [r.studentId, r]));
    const parentById = new Map(parents.map((p) => [p.id, p]));
    return students.map((s) => {
        const r = byStudent.get(s.id);
        const p = s.parentId ? parentById.get(s.parentId) : undefined;
        return {
            studentId: s.id,
            name: s.name,
            surname: s.surname,
            parentName: p?.name ?? null,
            parentPhone: p?.phone ?? null,
            answer: r?.answer ?? null,
            paid: r?.paid ?? false,
            note: r?.note ?? null,
            answeredAt: r?.answeredAt ?? null,
        };
    });
};

export const setPaid = async (branchId: string, id: unknown, studentId: unknown, paid: unknown) => {
    if (typeof paid !== 'boolean') throw new Error('paid must be a boolean');
    assertId('studentId', studentId);
    const activity = await loadActivity(branchId, id);
    const response = await prisma.activityResponse.findFirst({ where: { activityId: activity.id, studentId, branchId } });
    if (!response) throw new Error('Pas de réponse');
    return prisma.activityResponse.update({ where: { id: response.id }, data: { paid } });
};

/** Re-notifies the parents of targeted students who have not answered yet. */
export const remind = async (branchId: string, id: unknown) => {
    const activity = await loadActivity(branchId, id);
    if (!activity.published) throw new Error("L'activité n'est pas publiée");
    const [students, responses] = await Promise.all([
        targetedStudents(branchId, activity),
        prisma.activityResponse.findMany({ where: { activityId: activity.id }, select: { studentId: true } }),
    ]);
    const answered = new Set(responses.map((r) => r.studentId));
    const parentIds = [...new Set(students.filter((s) => !answered.has(s.id)).map((s) => s.parentId).filter((p): p is string => !!p))];
    await notifyParents(branchId, activity, parentIds, true);
    return { parents: parentIds.length };
};

const endOfDayUtc = (d: Date) => {
    const e = new Date(d);
    e.setUTCHours(23, 59, 59, 999);
    return e;
};

/** Public: a parent answers (YES/NO) for one of their children. Upserts by (activityId, studentId), keeps `paid`. */
export const respondAsParent = async (rawToken: string, body: { activityId?: unknown; studentId?: unknown; answer?: unknown; note?: unknown }) => {
    const { activityId, studentId, answer } = body || {};
    assertId('activityId', activityId);
    assertId('studentId', studentId);
    if (answer !== 'YES' && answer !== 'NO') throw new Error('answer must be YES or NO');
    const note = optionalText('note', body?.note, MAX_NOTE);

    if (typeof rawToken !== 'string' || !rawToken) throw new Error('Not found');
    const parent = await prisma.parent.findUnique({
        where: { accessTokenHash: hashToken(rawToken) },
        select: { id: true, branchId: true, students: { select: { id: true, branchId: true, active: true, groupIds: true } } },
    });
    if (!parent || !parent.branchId) throw new Error('Not found');
    const student = parent.students.find((s) => s.id === studentId && s.branchId === parent.branchId && s.active !== false);
    if (!student) throw new Error('Student not found');

    let activity;
    try {
        activity = await prisma.activity.findFirst({ where: { id: activityId, branchId: parent.branchId, published: true } });
    } catch {
        activity = null;
    }
    if (!activity) throw new Error('Activity not found');
    if (!isTargeted(activity, student)) throw new Error("Cet élève n'est pas concerné par cette activité");
    const now = new Date();
    if (activity.deadline && now > endOfDayUtc(activity.deadline)) throw new Error('La date limite de réponse est passée');
    if (now > new Date(activity.startAt)) throw new Error("L'activité a déjà commencé");

    const response = await prisma.activityResponse.upsert({
        where: { activityId_studentId: { activityId: activity.id, studentId: student.id } },
        create: { activityId: activity.id, studentId: student.id, parentId: parent.id, branchId: parent.branchId, answer, note, answeredAt: now },
        update: { answer, parentId: parent.id, answeredAt: now, ...(body?.note !== undefined && { note }) },
    });
    return { activityId: response.activityId, studentId: response.studentId, answer: response.answer, paid: response.paid, note: response.note };
};
