import prisma from '../../config/database';
import { notify, splitBilingual } from './dispatcher';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        parent: { findMany: jest.fn() },
        pushSubscription: { findMany: jest.fn() },
        whatsappChannel: { findUnique: jest.fn() },
        outboundMessage: { createMany: jest.fn() },
    },
}));

const m = (fn: unknown) => fn as jest.Mock;
const input = {
    kind: 'GRADE' as const,
    branchId: 'b1',
    title: { fr: 'Titre', ar: 'عنوان' },
    body: { fr: 'Corps', ar: 'نص' },
};
const queued = () => m(prisma.outboundMessage.createMany).mock.calls[0]?.[0].data ?? [];

beforeEach(() => {
    jest.clearAllMocks();
    m(prisma.parent.findMany).mockResolvedValue([
        { id: 'p1', phone: '0612345678', whatsapp: null },
        { id: 'p2', phone: '0699999999', whatsapp: '+212 600-000000' },
    ]);
    m(prisma.pushSubscription.findMany).mockResolvedValue([
        { parentId: 'p1', endpoint: 'https://push/a', lang: 'fr' },
        { parentId: 'p1', endpoint: 'https://push/b', lang: 'ar' },
    ]);
    m(prisma.whatsappChannel.findUnique).mockResolvedValue({ status: 'CONNECTED', sendAttendance: true, sendGrades: true, sendAnnouncements: false });
});

describe('notify', () => {
    it('queues a push per subscription in its language and a whatsapp per parent (normalised number)', async () => {
        const n = await notify(['p1', 'p2', 'p1'], input);
        expect(n).toBe(4);
        const rows = queued();
        const push = rows.filter((r: any) => r.channel === 'PUSH');
        expect(push).toEqual([
            expect.objectContaining({ parentId: 'p1', to: 'https://push/a', title: 'Titre', body: 'Corps', kind: 'GRADE', branchId: 'b1' }),
            expect.objectContaining({ parentId: 'p1', to: 'https://push/b', title: 'عنوان', body: 'نص' }),
        ]);
        const wa = rows.filter((r: any) => r.channel === 'WHATSAPP');
        expect(wa.map((r: any) => [r.parentId, r.to])).toEqual([['p1', '212612345678'], ['p2', '212600000000']]);
        expect(wa[0].body).toContain('Corps');
        expect(wa[0].body).toContain('نص');
    });

    it('no whatsapp when the channel is disconnected', async () => {
        m(prisma.whatsappChannel.findUnique).mockResolvedValue({ status: 'CONNECTING', sendGrades: true });
        await notify(['p1', 'p2'], input);
        expect(queued().every((r: any) => r.channel === 'PUSH')).toBe(true);
        expect(queued()).toHaveLength(2);
    });

    it('no whatsapp when the kind is off, push still sent', async () => {
        await notify(['p1', 'p2'], { ...input, kind: 'ANNOUNCEMENT' });
        expect(queued().map((r: any) => r.channel)).toEqual(['PUSH', 'PUSH']);
    });

    it('no channel row → push only; nothing to queue → no write', async () => {
        m(prisma.whatsappChannel.findUnique).mockResolvedValue(null);
        m(prisma.pushSubscription.findMany).mockResolvedValue([]);
        expect(await notify(['p1'], input)).toBe(0);
        expect(prisma.outboundMessage.createMany).not.toHaveBeenCalled();
        expect(await notify([], input)).toBe(0);
    });

    it('splitBilingual splits the first line break', () => {
        expect(splitBilingual('a\nb\nc')).toEqual({ fr: 'a', ar: 'b\nc' });
        expect(splitBilingual('x')).toEqual({ fr: 'x', ar: 'x' });
    });
});
