import prisma from '../../config/database';
import { isEvolutionConfigured, sendText, instanceName } from './evolution.client';
import { isPushConfigured, sendPush, isAllowedPushEndpoint } from './push.sender';

export const PUSH_BATCH_SIZE = 50;
export const WHATSAPP_GAP_MS = 4_000;
export const MAX_ATTEMPTS = 3;
export const LOCK_TIMEOUT_MS = 5 * 60_000;
export const RETENTION_DAYS = 60;
const CLEANUP_EVERY_MS = 24 * 60 * 60_000;
const BACKOFF_MIN = [1, 5, 15];
const ORDER = [{ priority: 'asc' as const }, { sendAfter: 'asc' as const }];

const errorText = (error: any) => String(error?.message || error || 'unknown error').slice(0, 500);

/**
 * One worker run. Push: up to 50 due rows, unthrottled. WhatsApp: per branch with due rows, that
 * branch's next row (priority, then sendAfter) when its last SENT WhatsApp is 4 s old or more, so one
 * branch's backlog never delays another. Every row is claimed (PENDING → SENDING) before sending.
 */
export const processOutbox = async (now: Date = new Date()): Promise<void> => {
    await prisma.outboundMessage.updateMany({
        where: { status: 'SENDING', lockedAt: { lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } },
        data: { status: 'PENDING', lockedAt: null },
    });

    const pushes = await prisma.outboundMessage.findMany({
        where: { status: 'PENDING', channel: 'PUSH', sendAfter: { lte: now } },
        orderBy: ORDER,
        take: PUSH_BATCH_SIZE,
    });
    for (const msg of pushes) {
        if (await claim(msg.id, now)) await processPush(msg, now);
    }

    const branches = await prisma.outboundMessage.findMany({
        where: { status: 'PENDING', channel: 'WHATSAPP', sendAfter: { lte: now } },
        distinct: ['branchId'],
        select: { branchId: true },
    });
    for (const { branchId } of branches) {
        const last = await prisma.outboundMessage.findFirst({
            where: { branchId, channel: 'WHATSAPP', status: 'SENT' },
            orderBy: { sentAt: 'desc' },
            select: { sentAt: true },
        });
        if (last?.sentAt && now.getTime() - new Date(last.sentAt).getTime() < WHATSAPP_GAP_MS) continue;
        const msg = await prisma.outboundMessage.findFirst({
            where: { status: 'PENDING', channel: 'WHATSAPP', branchId, sendAfter: { lte: now } },
            orderBy: ORDER,
        });
        if (msg && (await claim(msg.id, now))) await processWhatsapp(msg, now);
    }
};

/** Retention: finished rows older than 60 days. */
export const cleanupOutbox = async (now: Date = new Date()) => {
    const { count } = await prisma.outboundMessage.deleteMany({
        where: {
            status: { in: ['SENT', 'SKIPPED', 'FAILED'] },
            createdAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 86_400_000) },
        },
    });
    return count;
};

const claim = async (id: string, now: Date) => {
    const { count } = await prisma.outboundMessage.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'SENDING', lockedAt: now },
    });
    return count === 1;
};

const skip = (id: string, error: string) =>
    prisma.outboundMessage.update({ where: { id }, data: { status: 'SKIPPED', lockedAt: null, error } });

const markSent = (id: string, attempts: number, now: Date) =>
    prisma.outboundMessage.update({ where: { id }, data: { status: 'SENT', lockedAt: null, sentAt: now, attempts, error: null } });

const markFailure = (msg: { id: string; attempts: number }, error: any, now: Date) => {
    const attempts = msg.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
        return prisma.outboundMessage.update({ where: { id: msg.id }, data: { status: 'FAILED', lockedAt: null, attempts, error: errorText(error) } });
    }
    const sendAfter = new Date(now.getTime() + BACKOFF_MIN[attempts - 1] * 60_000);
    return prisma.outboundMessage.update({
        where: { id: msg.id },
        data: { status: 'PENDING', lockedAt: null, attempts, sendAfter, error: errorText(error) },
    });
};

const processPush = async (msg: any, now: Date) => {
    if (!isPushConfigured()) return skip(msg.id, 'Push not configured (VAPID keys missing)');
    const sub = msg.to ? await prisma.pushSubscription.findUnique({ where: { endpoint: msg.to } }) : null;
    if (!sub) return skip(msg.id, 'Push subscription no longer exists');
    if (!isAllowedPushEndpoint(sub.endpoint)) {
        await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        return skip(msg.id, 'Push endpoint not allowed');
    }
    try {
        await sendPush(sub, { title: msg.title || '', body: msg.body, url: msg.url });
        return markSent(msg.id, msg.attempts + 1, now);
    } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
            return skip(msg.id, `Push subscription expired (${error.statusCode})`);
        }
        return markFailure(msg, error, now);
    }
};

const processWhatsapp = async (msg: any, now: Date) => {
    if (!isEvolutionConfigured()) return skip(msg.id, 'WhatsApp not configured (Evolution API env missing)');
    if (!msg.to) return skip(msg.id, 'No phone number');
    const channel = await prisma.whatsappChannel.findUnique({ where: { branchId: msg.branchId } });
    if (!channel || channel.status !== 'CONNECTED') return skip(msg.id, 'WhatsApp déconnecté');
    try {
        await sendText(instanceName(msg.branchId), msg.to, msg.body);
        return markSent(msg.id, msg.attempts + 1, now);
    } catch (error) {
        return markFailure(msg, error, now);
    }
};

let running = false;
let timer: NodeJS.Timeout | null = null;
let lastCleanup = 0;

export const startOutboxWorker = (intervalMs = 5_000): void => {
    if (timer) return;
    timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
            const now = new Date();
            if (now.getTime() - lastCleanup >= CLEANUP_EVERY_MS) {
                lastCleanup = now.getTime();
                const removed = await cleanupOutbox(now);
                if (removed) console.log(`[outbox] retention cleanup removed ${removed} rows`);
            }
            await processOutbox(now);
        } catch (error) {
            console.error('[outbox] run failed:', error);
        } finally {
            running = false;
        }
    }, intervalMs);
};
