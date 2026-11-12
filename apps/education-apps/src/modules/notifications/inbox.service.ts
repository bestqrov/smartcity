import prisma from '../../config/database';
import { hashToken } from '../../utils/accessToken';

export const INBOX_DEFAULT_LIMIT = 30;
export const INBOX_MAX_LIMIT = 50;

const findParentId = async (rawToken: string): Promise<string> => {
    const parent = await prisma.parent.findUnique({ where: { accessTokenHash: hashToken(rawToken) }, select: { id: true } });
    if (!parent) throw new Error('Parent not found');
    return parent.id;
};

const unreadCount = (parentId: string) => prisma.parentNotification.count({ where: { parentId, readAt: null } });

export const parseLimit = (raw: unknown): number => {
    const n = parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(n) || n < 1) return INBOX_DEFAULT_LIMIT;
    return Math.min(n, INBOX_MAX_LIMIT);
};

export const listInbox = async (rawToken: string, before?: unknown, limitRaw?: unknown) => {
    const parentId = await findParentId(rawToken);
    const limit = parseLimit(limitRaw);
    const where: any = { parentId };
    if (before !== undefined && before !== '') {
        // Cursor: `<ISO>_<id>` (stable on equal timestamps) or a plain ISO date (legacy).
        const raw = String(before);
        const sep = raw.lastIndexOf('_');
        const iso = sep === -1 ? raw : raw.slice(0, sep);
        const id = sep === -1 ? null : raw.slice(sep + 1);
        const d = new Date(iso);
        if (Number.isNaN(d.getTime()) || (id !== null && !/^[0-9a-f]{24}$/i.test(id))) throw new Error('Invalid before');
        if (id) where.OR = [{ createdAt: { lt: d } }, { createdAt: d, id: { lt: id } }];
        else where.createdAt = { lt: d };
    }
    const [rows, unread] = await Promise.all([
        prisma.parentNotification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1 }),
        unreadCount(parentId),
    ]);
    const page = rows.slice(0, limit);
    const items = page.map((r) => ({
        id: r.id,
        kind: r.kind,
        title: { fr: r.titleFr, ar: r.titleAr },
        body: { fr: r.bodyFr, ar: r.bodyAr },
        path: r.path ?? null,
        studentId: r.studentId ?? null,
        read: !!r.readAt,
        createdAt: r.createdAt,
    }));
    const nextBefore = rows.length > limit && page.length > 0 ? `${page[page.length - 1].createdAt.toISOString()}_${page[page.length - 1].id}` : null;
    return { items, unread, nextBefore };
};

/** No ids = mark everything read. Always scoped to the token's parent. */
export const markRead = async (rawToken: string, ids?: unknown) => {
    const parentId = await findParentId(rawToken);
    const where: any = { parentId, readAt: null };
    if (ids !== undefined && ids !== null) {
        if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) throw new Error('ids must be an array of strings');
        where.id = { in: ids.filter((i: string) => /^[0-9a-f]{24}$/i.test(i)) };
    }
    await prisma.parentNotification.updateMany({ where, data: { readAt: new Date() } });
    return { unread: await unreadCount(parentId) };
};
