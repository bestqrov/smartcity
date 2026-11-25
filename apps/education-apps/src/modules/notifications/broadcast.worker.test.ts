import prisma from '../../config/database';
import { processBroadcasts, BROADCAST_MAX_ATTEMPTS } from './broadcast.worker';
import { sendText } from './evolution.client';
import { isMailConfigured, sendMail } from './mailer';
import { refreshBroadcastCounts } from '../platform/broadcasts.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        broadcastMessage: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
        platformWhatsapp: { findUnique: jest.fn() },
    },
}));
jest.mock('./evolution.client', () => ({ isEvolutionConfigured: jest.fn(() => true), sendText: jest.fn() }));
jest.mock('./mailer', () => ({ isMailConfigured: jest.fn(() => true), sendMail: jest.fn() }));
jest.mock('./platformWhatsapp.service', () => ({ PLATFORM_INSTANCE: 'arwa-platform' }));
jest.mock('../platform/broadcasts.service', () => ({ refreshBroadcastCounts: jest.fn() }));

const m = (fn: unknown) => fn as jest.Mock;
const now = new Date('2026-11-25T10:00:00Z');
const email = (id: string, attempts = 0) => ({ id, broadcastId: 'bc1', channel: 'EMAIL', to: 'a@b.co', subject: 'S', body: 'B', attempts });
const wa = (id: string, attempts = 0) => ({ id, broadcastId: 'bc2', channel: 'WHATSAPP', to: '212600000000', body: 'B', attempts });
const updateFor = (id: string) => m(prisma.broadcastMessage.update).mock.calls.find((c) => c[0].where.id === id)?.[0].data;

const setup = (opts: { emails?: any[]; wa?: any; lastSent?: Date | null; connected?: boolean }) => {
    m(prisma.broadcastMessage.findMany).mockResolvedValue(opts.emails ?? []);
    m(prisma.broadcastMessage.findFirst).mockImplementation(async (args: any) =>
        args.where.status === 'SENT' ? (opts.lastSent ? { sentAt: opts.lastSent } : null) : opts.wa ?? null,
    );
    m(prisma.platformWhatsapp.findUnique).mockResolvedValue({ status: opts.connected === false ? 'DISCONNECTED' : 'CONNECTED' });
};

beforeEach(() => {
    jest.clearAllMocks();
    m(isMailConfigured).mockReturnValue(true);
    m(prisma.broadcastMessage.updateMany).mockResolvedValue({ count: 1 });
});

it('sends due emails and one WhatsApp, then refreshes the counts', async () => {
    setup({ emails: [email('e1'), email('e2')], wa: wa('w1') });
    await processBroadcasts(now);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendText).toHaveBeenCalledWith('arwa-platform', '212600000000', 'B');
    expect(updateFor('e1')).toMatchObject({ status: 'SENT', attempts: 1 });
    expect(updateFor('w1')).toMatchObject({ status: 'SENT' });
    expect(refreshBroadcastCounts).toHaveBeenCalledWith('bc1');
    expect(refreshBroadcastCounts).toHaveBeenCalledWith('bc2');
});

it('waits 8 s between platform WhatsApp messages', async () => {
    setup({ wa: wa('w1'), lastSent: new Date(now.getTime() - 3_000) });
    await processBroadcasts(now);
    expect(sendText).not.toHaveBeenCalled();
});

it('retries with backoff, then FAILED after the last attempt', async () => {
    m(sendMail).mockRejectedValue(new Error('smtp down'));
    setup({ emails: [email('e1'), email('e2', BROADCAST_MAX_ATTEMPTS - 1)] });
    await processBroadcasts(now);
    expect(updateFor('e1')).toMatchObject({ status: 'PENDING', attempts: 1, error: 'smtp down' });
    expect(updateFor('e1').sendAfter.getTime()).toBe(now.getTime() + 60_000);
    expect(updateFor('e2')).toMatchObject({ status: 'FAILED', attempts: BROADCAST_MAX_ATTEMPTS });
});

it('fails without using attempts when the channel is gone', async () => {
    m(isMailConfigured).mockReturnValue(false);
    setup({ emails: [email('e1')], wa: wa('w1'), connected: false });
    await processBroadcasts(now);
    expect(sendMail).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    expect(updateFor('e1')).toMatchObject({ status: 'FAILED' });
    expect(updateFor('e1').attempts).toBeUndefined();
    expect(updateFor('w1')).toMatchObject({ status: 'FAILED', error: 'WhatsApp plateforme déconnecté' });
});

it('skips a row another worker already claimed', async () => {
    setup({ emails: [email('e1')] });
    m(prisma.broadcastMessage.updateMany).mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 0 });
    await processBroadcasts(now);
    expect(sendMail).not.toHaveBeenCalled();
});
