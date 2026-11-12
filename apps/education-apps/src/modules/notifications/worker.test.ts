import prisma from '../../config/database';
import { processOutbox } from './worker';
import { sendText } from './evolution.client';
import { sendPush } from './push.sender';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        outboundMessage: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
        pushSubscription: { findUnique: jest.fn(), deleteMany: jest.fn() },
    },
}));
jest.mock('./evolution.client', () => ({
    isEvolutionConfigured: jest.fn(() => true),
    instanceName: (b: string) => `arwa-${b}`,
    sendText: jest.fn(),
}));
jest.mock('./push.sender', () => ({ isPushConfigured: jest.fn(() => true), sendPush: jest.fn() }));

const m = (fn: unknown) => fn as jest.Mock;
const now = new Date('2026-11-12T10:00:00Z');
const wa = (id: string, branchId: string, attempts = 0) => ({ id, branchId, channel: 'WHATSAPP', to: '212600000000', body: 'hi', attempts });
const push = (id: string, attempts = 0) => ({ id, branchId: 'b1', channel: 'PUSH', to: 'https://push/a', title: 't', body: 'b', url: null, attempts });
const updateFor = (id: string) => m(prisma.outboundMessage.update).mock.calls.find((c) => c[0].where.id === id)?.[0].data;

beforeEach(() => {
    jest.clearAllMocks();
    m(prisma.outboundMessage.findFirst).mockResolvedValue(null);
    m(prisma.pushSubscription.findUnique).mockResolvedValue({ endpoint: 'https://push/a', p256dh: 'k', auth: 'a' });
    const { isEvolutionConfigured } = jest.requireMock('./evolution.client');
    isEvolutionConfigured.mockReturnValue(true);
});

describe('processOutbox', () => {
    it('takes up to 20 due PENDING messages', async () => {
        m(prisma.outboundMessage.findMany).mockResolvedValue([]);
        await processOutbox(now);
        expect(prisma.outboundMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: 'PENDING', sendAfter: { lte: now } }, take: 20,
        }));
    });

    it('sends at most one whatsapp per branch per run, pushes unthrottled', async () => {
        m(prisma.outboundMessage.findMany).mockResolvedValue([wa('w1', 'b1'), wa('w2', 'b1'), wa('w3', 'b2'), push('p1'), push('p2')]);
        await processOutbox(now);
        expect(sendText).toHaveBeenCalledTimes(2);
        expect(sendText).toHaveBeenCalledWith('arwa-b1', '212600000000', 'hi');
        expect(sendText).toHaveBeenCalledWith('arwa-b2', '212600000000', 'hi');
        expect(sendPush).toHaveBeenCalledTimes(2);
        expect(updateFor('w1')).toMatchObject({ status: 'SENT', sentAt: now, attempts: 1 });
        expect(updateFor('w2')).toBeUndefined();
    });

    it('waits when the branch last SENT whatsapp is under 4 seconds old', async () => {
        m(prisma.outboundMessage.findMany).mockResolvedValue([wa('w1', 'b1')]);
        m(prisma.outboundMessage.findFirst).mockResolvedValue({ sentAt: new Date(now.getTime() - 2000) });
        await processOutbox(now);
        expect(sendText).not.toHaveBeenCalled();
        m(prisma.outboundMessage.findFirst).mockResolvedValue({ sentAt: new Date(now.getTime() - 4000) });
        await processOutbox(now);
        expect(sendText).toHaveBeenCalledTimes(1);
    });

    it('retries with 1 / 5 minute backoff then FAILED on the third failure', async () => {
        m(sendText).mockRejectedValue(new Error('boom'));
        m(prisma.outboundMessage.findMany).mockResolvedValue([wa('a', 'b1', 0), wa('b', 'b2', 1), wa('c', 'b3', 2)]);
        await processOutbox(now);
        expect(updateFor('a')).toEqual({ attempts: 1, sendAfter: new Date(now.getTime() + 60_000), error: 'boom' });
        expect(updateFor('b')).toEqual({ attempts: 2, sendAfter: new Date(now.getTime() + 5 * 60_000), error: 'boom' });
        expect(updateFor('c')).toEqual({ status: 'FAILED', attempts: 3, error: 'boom' });
    });

    it('an expired push endpoint (410/404) deletes the subscription and SKIPs', async () => {
        m(sendPush).mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));
        m(prisma.outboundMessage.findMany).mockResolvedValue([push('p1')]);
        await processOutbox(now);
        expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { endpoint: 'https://push/a' } });
        expect(updateFor('p1')).toMatchObject({ status: 'SKIPPED' });
    });

    it('SKIPs whatsapp with an error when Evolution is not configured', async () => {
        jest.requireMock('./evolution.client').isEvolutionConfigured.mockReturnValue(false);
        m(prisma.outboundMessage.findMany).mockResolvedValue([wa('w1', 'b1')]);
        await processOutbox(now);
        expect(sendText).not.toHaveBeenCalled();
        expect(updateFor('w1')).toMatchObject({ status: 'SKIPPED', error: expect.stringContaining('not configured') });
    });
});
