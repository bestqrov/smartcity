import prisma from '../../config/database';
import { assertId } from '../transport/ids';
import { DEFAULT_INSTITUTION_TYPE } from '../packs/packs.constants';

// Requests a school admin sends to the super admin: a move to a smaller pack (billing and the limits in use
// make it a manual decision), a feature, a pack option, a problem. The SA answers with a status and a reply.

export const REQUEST_KINDS = ['PACK_DOWNGRADE', 'FEATURE', 'PACK_OPTION', 'PROBLEM', 'OTHER'] as const;
export const REQUEST_STATUSES = ['NEW', 'IN_PROGRESS', 'DONE', 'REJECTED'] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const MAX_MESSAGE = 2000;
export const MAX_REPLY = 2000;

const SA_SELECT = {
    id: true,
    schoolId: true,
    branchId: true,
    kind: true,
    message: true,
    targetPackId: true,
    targetPackName: true,
    status: true,
    reply: true,
    createdAt: true,
    updatedAt: true,
    school: { select: { id: true, name: true, city: true, status: true, ownerName: true, ownerPhone: true, pack: { select: { name: true } } } },
} as const;

// What the school sees of its own requests.
const MINE_SELECT = {
    id: true,
    kind: true,
    message: true,
    targetPackName: true,
    status: true,
    reply: true,
    createdAt: true,
    updatedAt: true,
} as const;

const text = (value: unknown, label: string, max: number, required: boolean): string | null => {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
        if (required) throw new Error(`${label} is required`);
        return null;
    }
    if (typeof value !== 'string') throw new Error(`${label} must be text`);
    const trimmed = value.trim();
    if (trimmed.length > max) throw new Error(`${label} is too long (${max} characters max)`);
    return trimmed;
};

// branchId always comes from the token (tenantScope), never from the body.
export const createSchoolRequest = async (branchId: string, userId: string, input: Record<string, unknown>) => {
    assertId('Branch id', branchId);
    const kind = REQUEST_KINDS.find((k) => k === input.kind);
    if (!kind) throw new Error('kind must be PACK_DOWNGRADE, FEATURE, PACK_OPTION, PROBLEM or OTHER');

    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { schoolId: true } });
    if (!branch) throw new Error('Branch not found');

    let targetPackId: string | null = null;
    let targetPackName: string | null = null;
    let message: string | null;

    if (kind === 'PACK_DOWNGRADE') {
        if (typeof input.targetPackCode !== 'string' || !input.targetPackCode.trim()) throw new Error('Target pack is required');
        const school = await prisma.school.findUnique({ where: { id: branch.schoolId }, include: { pack: true } });
        if (!school) throw new Error('School not found');
        const pack = await prisma.pack.findFirst({ where: { code: input.targetPackCode.trim(), active: true } });
        if (!pack) throw new Error('Pack not found');
        if (!pack.institutionTypes.includes(school.institutionType ?? DEFAULT_INSTITUTION_TYPE)) {
            throw new Error('Pack does not serve this institution type');
        }
        if (!school.pack || pack.monthlyPrice >= school.pack.monthlyPrice) {
            throw new Error('Only a smaller pack can be requested');
        }
        const pending = await prisma.schoolRequest.findFirst({
            where: { schoolId: school.id, kind: 'PACK_DOWNGRADE', status: { in: ['NEW', 'IN_PROGRESS'] } },
            select: { id: true },
        });
        if (pending) throw new Error('A pack change request is already pending');
        targetPackId = pack.id;
        targetPackName = pack.name;
        message = text(input.message, 'Message', MAX_MESSAGE, false) ?? '';
    } else {
        message = text(input.message, 'Message', MAX_MESSAGE, true);
    }

    return prisma.schoolRequest.create({
        data: {
            schoolId: branch.schoolId,
            branchId,
            byUserId: userId,
            kind,
            message: message ?? '',
            targetPackId,
            targetPackName,
        },
        select: MINE_SELECT,
    });
};

// Every request of the caller's school (all its branches), newest first.
export const listMySchoolRequests = async (branchId: string) => {
    assertId('Branch id', branchId);
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { schoolId: true } });
    if (!branch) throw new Error('Branch not found');
    return prisma.schoolRequest.findMany({ where: { schoolId: branch.schoolId }, orderBy: { createdAt: 'desc' }, take: 50, select: MINE_SELECT });
};

// ---- super admin
export const listSchoolRequests = (status?: unknown) => {
    const filter = REQUEST_STATUSES.find((s) => s === status);
    return prisma.schoolRequest.findMany({
        where: filter ? { status: filter } : {},
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: SA_SELECT,
    });
};

export const countNewSchoolRequests = () => prisma.schoolRequest.count({ where: { status: 'NEW' } });

export const updateSchoolRequest = async (id: unknown, input: Record<string, unknown>) => {
    assertId('Request id', id);
    const data: { status?: RequestStatus; reply?: string | null } = {};
    if (input.status !== undefined) {
        const status = REQUEST_STATUSES.find((s) => s === input.status);
        if (!status) throw new Error('status must be NEW, IN_PROGRESS, DONE or REJECTED');
        data.status = status;
    }
    if (input.reply !== undefined) data.reply = text(input.reply, 'Reply', MAX_REPLY, false);
    if (Object.keys(data).length === 0) throw new Error('Nothing to update');

    const existing = await prisma.schoolRequest.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error('Request not found');
    return prisma.schoolRequest.update({ where: { id }, data, select: SA_SELECT });
};
