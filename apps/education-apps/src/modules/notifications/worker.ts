import prisma from '../../config/database';
import { isEvolutionConfigured, sendText, instanceName } from './evolution.client';
import { isPushConfigured, sendPush } from './push.sender';

export const BATCH_SIZE = 20;
export const WHATSAPP_GAP_MS = 4_000;
export const MAX_ATTEMPTS = 3;
const BACKOFF_MIN = [1, 5, 15];

const errorText = (error: any) => String(error?.message || error || 'unknown error').slice(0, 500);

/**
 * One worker run: up to 20 due PENDING messages. Push is sent unthrottled; WhatsApp at most one per
 * branch per run and only when that branch's last SENT WhatsApp is 4 s old or more.
 */
export const processOutbox = async (now: Date = new Date()): Promise<void> => {
    const due = await prisma.outboundMessage.findMany({
        where: { status: 'PENDING', sendAfter: { lte: now } },
        orderBy: { sendAfter: 'asc' },
        take: BATCH_SIZE,
    });
    const whatsappBranchesDone = new Set<string>();

    for (const msg of due) {
        if (msg.channel === 'PUSH') {
            await processPush(msg, now);
        } else if (msg.channel === 'WHATSAPP') {
            if (whatsappBranchesDone.has(msg.branchId)) continue;
            const last = await prisma.outboundMessage.findFirst({
                where: { branchId: msg.branchId, channel: 'WHATSAPP', status: 'SENT' },
                orderBy: { sentAt: 'desc' },
                select: { sentAt: true },
            });
            if (last?.sentAt && now.getTime() - new Date(last.sentAt).getTime() < WHATSAPP_GAP_MS) {
                whatsappBranchesDone.add(msg.branchId);
                continue;
            }
            whatsappBranchesDone.add(msg.branchId);
            await processWhatsapp(msg, now);
        } else {
            await skip(msg.id, `Unsupported channel ${msg.channel}`);
        }
    }
};

const skip = (id: string, error: string) =>
    prisma.outboundMessage.update({ where: { id }, data: { status: 'SKIPPED', error } });

const markSent = (id: string, attempts: number, now: Date) =>
    prisma.outboundMessage.update({ where: { id }, data: { status: 'SENT', sentAt: now, attempts, error: null } });

const markFailure = (msg: { id: string; attempts: number }, error: any, now: Date) => {
    const attempts = msg.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
        return prisma.outboundMessage.update({ where: { id: msg.id }, data: { status: 'FAILED', attempts, error: errorText(error) } });
    }
    const sendAfter = new Date(now.getTime() + BACKOFF_MIN[attempts - 1] * 60_000);
    return prisma.outboundMessage.update({ where: { id: msg.id }, data: { attempts, sendAfter, error: errorText(error) } });
};

const processPush = async (msg: any, now: Date) => {
    if (!isPushConfigured()) return skip(msg.id, 'Push not configured (VAPID keys missing)');
    const sub = msg.to ? await prisma.pushSubscription.findUnique({ where: { endpoint: msg.to } }) : null;
    if (!sub) return skip(msg.id, 'Push subscription no longer exists');
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
    try {
        await sendText(instanceName(msg.branchId), msg.to, msg.body);
        return markSent(msg.id, msg.attempts + 1, now);
    } catch (error) {
        return markFailure(msg, error, now);
    }
};

let running = false;
let timer: NodeJS.Timeout | null = null;

export const startOutboxWorker = (intervalMs = 5_000): void => {
    if (timer) return;
    timer = setInterval(async () => {
        if (running) return;
        running = true;
        try {
            await processOutbox(new Date());
        } catch (error) {
            console.error('[outbox] run failed:', error);
        } finally {
            running = false;
        }
    }, intervalMs);
};
