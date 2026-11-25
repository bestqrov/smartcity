import prisma from '../../config/database';
import { isEvolutionConfigured, sendText } from './evolution.client';
import { isMailConfigured, sendMail } from './mailer';
import { PLATFORM_INSTANCE } from './platformWhatsapp.service';
import { refreshBroadcastCounts } from '../platform/broadcasts.service';

export const BROADCAST_EMAIL_BATCH = 10;
export const BROADCAST_WHATSAPP_GAP_MS = 8_000;
export const BROADCAST_MAX_ATTEMPTS = 3;
export const BROADCAST_LOCK_TIMEOUT_MS = 5 * 60_000;
const BACKOFF_MIN = [1, 5, 15];

const errorText = (error: any) => String(error?.message || error || 'unknown error').slice(0, 500);

const claim = async (id: string, now: Date) => {
    const { count } = await prisma.broadcastMessage.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'SENDING', lockedAt: now },
    });
    return count === 1;
};

const markSent = (msg: { id: string; attempts: number }, now: Date) =>
    prisma.broadcastMessage.update({
        where: { id: msg.id },
        data: { status: 'SENT', lockedAt: null, sentAt: now, attempts: msg.attempts + 1, error: null },
    });

const markFailure = (msg: { id: string; attempts: number }, error: any, now: Date) => {
    const attempts = msg.attempts + 1;
    if (attempts >= BROADCAST_MAX_ATTEMPTS) {
        return prisma.broadcastMessage.update({
            where: { id: msg.id },
            data: { status: 'FAILED', lockedAt: null, attempts, error: errorText(error) },
        });
    }
    return prisma.broadcastMessage.update({
        where: { id: msg.id },
        data: { status: 'PENDING', lockedAt: null, attempts, error: errorText(error), sendAfter: new Date(now.getTime() + BACKOFF_MIN[attempts - 1] * 60_000) },
    });
};

/** The channel is gone (SMTP removed, number disconnected): FAILED without using attempts, so «Relancer» can requeue it. */
const markUnavailable = (id: string, error: string) =>
    prisma.broadcastMessage.update({ where: { id }, data: { status: 'FAILED', lockedAt: null, error } });

/**
 * One run of the broadcast queue (school owners), separate from the parents' outbox.
 * Email: up to 10 due rows. WhatsApp: one row, only when the last platform WhatsApp was sent 8 s ago or more.
 */
export const processBroadcasts = async (now: Date = new Date()): Promise<void> => {
    await prisma.broadcastMessage.updateMany({
        where: { status: 'SENDING', lockedAt: { lt: new Date(now.getTime() - BROADCAST_LOCK_TIMEOUT_MS) } },
        data: { status: 'PENDING', lockedAt: null },
    });
    const touched = new Set<string>();

    const emails = await prisma.broadcastMessage.findMany({
        where: { status: 'PENDING', channel: 'EMAIL', sendAfter: { lte: now } },
        orderBy: { sendAfter: 'asc' },
        take: BROADCAST_EMAIL_BATCH,
    });
    for (const msg of emails) {
        if (!(await claim(msg.id, now))) continue;
        touched.add(msg.broadcastId);
        if (!isMailConfigured()) {
            await markUnavailable(msg.id, 'Email (SMTP) non configuré');
            continue;
        }
        try {
            await sendMail(msg.to!, msg.subject || '', msg.body);
            await markSent(msg, now);
        } catch (error) {
            await markFailure(msg, error, now);
        }
    }

    const last = await prisma.broadcastMessage.findFirst({
        where: { channel: 'WHATSAPP', status: 'SENT' },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
    });
    const throttled = !!last?.sentAt && now.getTime() - new Date(last.sentAt).getTime() < BROADCAST_WHATSAPP_GAP_MS;
    if (!throttled) {
        const msg = await prisma.broadcastMessage.findFirst({
            where: { status: 'PENDING', channel: 'WHATSAPP', sendAfter: { lte: now } },
            orderBy: { sendAfter: 'asc' },
        });
        if (msg && (await claim(msg.id, now))) {
            touched.add(msg.broadcastId);
            const channel = isEvolutionConfigured() ? await prisma.platformWhatsapp.findUnique({ where: { key: 'default' } }) : null;
            if (!channel || channel.status !== 'CONNECTED') {
                await markUnavailable(msg.id, 'WhatsApp plateforme déconnecté');
            } else {
                try {
                    await sendText(PLATFORM_INSTANCE, msg.to!, msg.body);
                    await markSent(msg, now);
                } catch (error) {
                    await markFailure(msg, error, now);
                }
            }
        }
    }

    for (const id of touched) await refreshBroadcastCounts(id);
};
