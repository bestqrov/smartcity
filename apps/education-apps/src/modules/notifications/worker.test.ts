import prisma from '../../config/database';
import { processOutbox, cleanupOutbox, PUSH_BATCH_SIZE } from './worker';
import { sendText } from './evolution.client';
import { sendPush } from './push.sender';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        outboundMessage: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
        pushSubscription: { findUnique: jest.fn(), deleteMany: jest.fn() },
        whatsappChannel: { findUnique: jest.fn() },
        parentNotification: { deleteMany: jest.fn() },
    },
}));
jest.mock('./evolution.client', () => ({
    isEvolutionConfigured: jest.fn(() => true),
    instanceName: (b: string) => `arwa-${b}`,
    sendText: jest.fn(),
}));
jest.mock('./push.sender', () => ({
    isPushConfigured: jest.fn(() => true),
    sendPush: jest.fn(),
    isAllowedPushEndpoint: jest.requireActual('./push.sender').isAllowedPushEndpoint,
}));

const m = (fn: unknown) => fn as jest.Mock;
const now = new Date('2026-11-12T10:00:00Z');
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';
const wa = (id: string, branchId: string, attempts = 0) => ({ id, branchId, channel: 'WHATSAPP', to: '212600000000', body: 'hi', attempts });
const push = (id: string, attempts = 0, to = ENDPOINT) => ({ id, branchId: 'b1', channel: 'PUSH', to, title: 't', body: 'b', url: null, attempts });
const updateFor = (id: string) => m(prisma.outboundMessage.update).mock.calls.find((c) => c[0].where.id === id)?.[0].data;

/** Wires findMany (push rows / whatsapp branches) and findFirst (last SENT / next row per branch). */
const setup = (opts: { push?: any[]; wa?: any[]; lastSent?: Record<string, Date> }) => {
    const waRows = opts.wa ?? [];
    m(prisma.outboundMessage.findMany).mockImplementation(async (args: any) => {
        if (args.where.channel === 'PUSH') return opts.push ?? [];
        return [...new Set(waRows.map((r) => r.branchId))].map((branchId) => ({ branchId }));
    });
    m(prisma.outboundMessage.findFirst).mockImplementation(async (args: any) => {
        if (args.where.status === 'SENT') {
            const at = opts.lastSent?.[args.where.branchId];
            return at ? { sentAt: at } : null;
        }
        return waRows.find((r) => r.branchId === args.where.branchId) ?? null;
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    m(prisma.outboundMessage.updateMany).mockResolvedValue({ count: 1 });
    m(prisma.pushSubscription.findUnique).mockResolvedValue({ endpoint: ENDPOINT, p256dh: 'k', auth: 'a' });
    m(prisma.whatsappChannel.findUnique).mockResolvedValue({ status: 'CONNECTED' });
    jest.requireMock('./evolution.client').isEvolutionConfigured.mockReturnValue(true);
});

describe('processOutbox', () => {
    it('requeues stale SENDING rows older than 5 minutes', async () => {
        setup({});
        await processOutbox(now);
        expect(prisma.outboundMessage.updateMany).toHaveBeenCalledWith({
            where: { status: 'SENDING', lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
            data: { status: 'PENDING', lockedAt: null },
        });
    });

    it('takes up to 50 due PENDING push rows by priority', async () => {
        setup({});
        await processOutbox(now);
        expect(PUSH_BATCH_SIZE).toBe(50);
        expect(prisma.outboundMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: 'PENDING', channel: 'PUSH', sendAfter: { lte: now } },
            orderBy: [{ priority: 'asc' }, { sendAfter: 'asc' }],
            take: 50,
        }));
    });

    it('sends one whatsapp per branch with due rows, pushes unthrottled', async () => {
        setup({ wa: [wa('w1', 'b1'), wa('w2', 'b1'), wa('w3', 'b2')], push: [push('p1'), push('p2')] });
        await processOutbox(now);
        expect(sendText).toHaveBeenCalledTimes(2);
        expect(sendText).toHaveBeenCalledWith('arwa-b1', '212600000000', 'hi');
        expect(sendText).toHaveBeenCalledWith('arwa-b2', '212600000000', 'hi');
        expect(sendPush).toHaveBeenCalledTimes(2);
        expect(updateFor('w1')).toMatchObject({ status: 'SENT', sentAt: now, attempts: 1 });
        expect(updateFor('w2')).toBeUndefined();
        expect(prisma.outboundMessage.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: 'PENDING', channel: 'WHATSAPP', branchId: 'b1', sendAfter: { lte: now } },
            orderBy: [{ priority: 'asc' }, { sendAfter: 'asc' }],
        }));
    });

    it('a throttled branch does not block another branch', async () => {
        setup({ wa: [wa('w1', 'b1'), wa('w2', 'b2')], lastSent: { b1: new Date(now.getTime() - 2000) } });
        await processOutbox(now);
        expect(sendText).toHaveBeenCalledTimes(1);
        expect(sendText).toHaveBeenCalledWith('arwa-b2', '212600000000', 'hi');
    });

    it('waits when the branch last SENT whatsapp is under 4 seconds old', async () => {
        setup({ wa: [wa('w1', 'b1')], lastSent: { b1: new Date(now.getTime() - 2000) } });
        await processOutbox(now);
        expect(sendText).not.toHaveBeenCalled();
        setup({ wa: [wa('w1', 'b1')], lastSent: { b1: new Date(now.getTime() - 4000) } });
        await processOutbox(now);
        expect(sendText).toHaveBeenCalledTimes(1);
    });

    it('claims a row PENDING → SENDING and does not send when the claim is lost', async () => {
        setup({ wa: [wa('w1', 'b1')], push: [push('p1')] });
        m(prisma.outboundMessage.updateMany).mockImplementation(async (args: any) =>
            ({ count: args.where.status === 'PENDING' ? 0 : 3 }));
        await processOutbox(now);
        expect(prisma.outboundMessage.updateMany).toHaveBeenCalledWith({
            where: { id: 'w1', status: 'PENDING' }, data: { status: 'SENDING', lockedAt: now },
        });
        expect(sendText).not.toHaveBeenCalled();
        expect(sendPush).not.toHaveBeenCalled();
    });

    it('retries with 1 / 5 minute backoff (back to PENDING) then FAILED on the third failure', async () => {
        m(sendText).mockRejectedValue(new Error('boom'));
        setup({ wa: [wa('a', 'b1', 0), wa('b', 'b2', 1), wa('c', 'b3', 2)] });
        await processOutbox(now);
        expect(updateFor('a')).toEqual({ status: 'PENDING', lockedAt: null, attempts: 1, sendAfter: new Date(now.getTime() + 60_000), error: 'boom' });
        expect(updateFor('b')).toEqual({ status: 'PENDING', lockedAt: null, attempts: 2, sendAfter: new Date(now.getTime() + 5 * 60_000), error: 'boom' });
        expect(updateFor('c')).toEqual({ status: 'FAILED', lockedAt: null, attempts: 3, error: 'boom' });
    });

    it('SKIPs whatsapp when the branch channel is not CONNECTED', async () => {
        setup({ wa: [wa('w1', 'b1')] });
        m(prisma.whatsappChannel.findUnique).mockResolvedValue({ status: 'DISCONNECTED' });
        await processOutbox(now);
        expect(sendText).not.toHaveBeenCalled();
        expect(updateFor('w1')).toMatchObject({ status: 'SKIPPED', error: 'WhatsApp déconnecté' });
    });

    it('an expired push endpoint (410/404) deletes the subscription and SKIPs', async () => {
        m(sendPush).mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
        setup({ push: [push('p1')] });
        await processOutbox(now);
        expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: ENDPOINT } });
        expect(updateFor('p1')).toMatchObject({ status: 'SKIPPED' });
    });

    it('a push endpoint outside the allowlist is SKIPPED and its subscription deleted', async () => {
        const evil = 'https://169.254.169.254/latest';
        setup({ push: [push('p1', 0, evil)] });
        m(prisma.pushSubscription.findUnique).mockResolvedValue({ endpoint: evil, p256dh: 'k', auth: 'a' });
        await processOutbox(now);
        expect(sendPush).not.toHaveBeenCalled();
        expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: evil } });
        expect(updateFor('p1')).toMatchObject({ status: 'SKIPPED' });
    });

    it('SKIPs whatsapp with an error when Evolution is not configured', async () => {
        jest.requireMock('./evolution.client').isEvolutionConfigured.mockReturnValue(false);
        setup({ wa: [wa('w1', 'b1')] });
        await processOutbox(now);
        expect(sendText).not.toHaveBeenCalled();
        expect(updateFor('w1')).toMatchObject({ status: 'SKIPPED', error: expect.stringContaining('not configured') });
    });
});

describe('cleanupOutbox', () => {
    it('deletes finished rows older than 60 days', async () => {
        m(prisma.outboundMessage.deleteMany).mockResolvedValue({ count: 4 });
        await cleanupOutbox(now);
        expect(prisma.outboundMessage.deleteMany).toHaveBeenCalledWith({
            where: { status: { in: ['SENT', 'SKIPPED', 'FAILED'] }, createdAt: { lt: new Date(now.getTime() - 60 * 86_400_000) } },
        });
    });

    it('deletes inbox notifications older than 180 days', async () => {
        m(prisma.outboundMessage.deleteMany).mockResolvedValue({ count: 0 });
        await cleanupOutbox(now);
        expect(prisma.parentNotification.deleteMany).toHaveBeenCalledWith({
            where: { createdAt: { lt: new Date(now.getTime() - 180 * 86_400_000) } },
        });
    });
});
