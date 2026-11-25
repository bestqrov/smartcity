import prisma from '../../config/database';
import {
    createBroadcast,
    emailBody,
    fillPlaceholders,
    findRecipients,
    previewBroadcast,
    retryBroadcast,
    schoolState,
    validateFilters,
    OPT_OUT_LINE,
} from './broadcasts.service';
import { isMailConfigured } from '../notifications/mailer';
import { isPlatformWhatsappConnected } from '../notifications/platformWhatsapp.service';

jest.mock('../../config/database', () => ({
    __esModule: true,
    default: {
        school: { findMany: jest.fn() },
        broadcast: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
        broadcastMessage: { createMany: jest.fn(), groupBy: jest.fn(), updateMany: jest.fn() },
    },
}));
jest.mock('../notifications/mailer', () => ({ isMailConfigured: jest.fn(() => true) }));
jest.mock('../notifications/platformWhatsapp.service', () => ({ isPlatformWhatsappConnected: jest.fn(async () => true) }));

const m = (fn: unknown) => fn as jest.Mock;
const now = new Date('2026-11-25T10:00:00Z');
const ID = 'a'.repeat(24);
const school = (over: Record<string, unknown> = {}) => ({
    id: 's1', name: 'Al Amal', status: 'PENDING', trialEndsAt: new Date('2026-12-01'), institutionType: null,
    ownerName: 'Karim', ownerEmail: 'karim@example.com', ownerPhone: '0612345678', email: null, phone: null, ...over,
});

beforeEach(() => {
    jest.clearAllMocks();
    m(isMailConfigured).mockReturnValue(true);
    m(isPlatformWhatsappConnected).mockResolvedValue(true);
    m(prisma.broadcastMessage.groupBy).mockResolvedValue([]);
    m(prisma.broadcast.update).mockImplementation(async (args: any) => ({ id: args.where.id, ...args.data }));
});

describe('schoolState', () => {
    it('maps status and trial end', () => {
        expect(schoolState({ status: 'ACTIVE', trialEndsAt: null }, now)).toBe('ACTIVE');
        expect(schoolState({ status: 'SUSPENDED', trialEndsAt: null }, now)).toBe('SUSPENDED');
        expect(schoolState({ status: 'PENDING', trialEndsAt: null }, now)).toBe('TRIAL');
        expect(schoolState({ status: 'PENDING', trialEndsAt: new Date('2026-12-01') }, now)).toBe('TRIAL');
        expect(schoolState({ status: 'PENDING', trialEndsAt: new Date('2026-11-01') }, now)).toBe('TRIAL_EXPIRED');
    });
});

describe('validateFilters', () => {
    it('keeps valid filters and drops empty ones', () => {
        expect(validateFilters({ states: ['ACTIVE'], packId: ID, institutionType: 'CRECHE', salesAgentId: '' })).toEqual({
            states: ['ACTIVE'], packId: ID, institutionType: 'CRECHE',
        });
        expect(validateFilters(undefined)).toEqual({});
    });
    it.each([[{ states: ['NOPE'] }], [{ packId: 'x' }], [{ institutionType: 'UNI' }], [{ salesAgentId: 12 }]])('refuses %j', (input) => {
        expect(() => validateFilters(input)).toThrow();
    });
});

describe('findRecipients', () => {
    it('filters in the query by pack/agent and in memory by state and type (null type = private school)', async () => {
        m(prisma.school.findMany).mockResolvedValue([
            school({ id: 'a', status: 'ACTIVE' }),
            school({ id: 'b', status: 'ACTIVE', institutionType: 'CRECHE' }),
            school({ id: 'c', status: 'PENDING' }),
        ]);
        const rows = await findRecipients({ states: ['ACTIVE'], institutionType: 'PRIVATE_SCHOOL', packId: ID }, now);
        expect(rows.map((r) => r.id)).toEqual(['a']);
        expect(m(prisma.school.findMany).mock.calls[0][0].where).toEqual({ packId: ID });
    });
});

describe('text helpers', () => {
    it('fills placeholders and appends the opt-out line to emails', () => {
        expect(fillPlaceholders('Bonjour {proprietaire} de {ecole} ({ecole})', { name: 'Al Amal', ownerName: 'Karim' })).toBe(
            'Bonjour Karim de Al Amal (Al Amal)',
        );
        expect(emailBody('Hi')).toBe(`Hi\n\n--\n${OPT_OUT_LINE}`);
    });
});

describe('previewBroadcast', () => {
    it('counts schools and reachable owners per channel', async () => {
        m(prisma.school.findMany).mockResolvedValue([school(), school({ id: 's2', ownerEmail: 'bad', ownerPhone: null })]);
        await expect(previewBroadcast({})).resolves.toEqual({ schools: 2, email: 1, whatsapp: 1, channels: { email: true, whatsapp: true } });
    });
});

describe('createBroadcast', () => {
    const input = { subject: 'Offre {ecole}', body: 'Bonjour {proprietaire}', channels: ['EMAIL', 'WHATSAPP'] };

    it('queues one message per school and channel, SKIPPED when the contact is missing', async () => {
        m(prisma.school.findMany).mockResolvedValue([school(), school({ id: 's2', name: 'B', ownerEmail: 'bad', ownerPhone: null })]);
        m(prisma.broadcast.create).mockResolvedValue({ id: 'bc1' });
        await createBroadcast(input, 'u1');
        const rows = m(prisma.broadcastMessage.createMany).mock.calls[0][0].data;
        expect(rows).toHaveLength(4);
        expect(rows[0]).toMatchObject({ channel: 'EMAIL', to: 'karim@example.com', subject: 'Offre Al Amal' });
        expect(rows[0].body).toContain('Bonjour Karim');
        expect(rows[1]).toMatchObject({ channel: 'WHATSAPP', to: '212612345678', body: '*Offre Al Amal*\n\nBonjour Karim' });
        expect(rows[2]).toMatchObject({ channel: 'EMAIL', to: null, status: 'SKIPPED' });
        expect(rows[3]).toMatchObject({ channel: 'WHATSAPP', to: null, status: 'SKIPPED' });
        expect(m(prisma.broadcast.create).mock.calls[0][0].data).toMatchObject({ total: 2, createdBy: 'u1' });
    });

    it('refuses a channel that is not available', async () => {
        m(isPlatformWhatsappConnected).mockResolvedValue(false);
        await expect(createBroadcast(input, 'u1')).rejects.toThrow('Platform WhatsApp is not connected');
        m(isMailConfigured).mockReturnValue(false);
        await expect(createBroadcast({ ...input, channels: ['EMAIL'] }, 'u1')).rejects.toThrow('Email (SMTP) is not configured');
    });

    it('validates subject, body, channels and an empty audience', async () => {
        await expect(createBroadcast({ ...input, subject: ' ' }, null)).rejects.toThrow('subject');
        await expect(createBroadcast({ ...input, body: '' }, null)).rejects.toThrow('body');
        await expect(createBroadcast({ ...input, channels: [] }, null)).rejects.toThrow('channels');
        m(prisma.school.findMany).mockResolvedValue([]);
        await expect(createBroadcast(input, null)).rejects.toThrow('No school matches');
        expect(prisma.broadcast.create).not.toHaveBeenCalled();
    });
});

describe('retryBroadcast', () => {
    it('requeues only FAILED messages with fresh attempts', async () => {
        m(prisma.broadcast.findUnique).mockResolvedValue({ id: ID });
        m(prisma.broadcastMessage.updateMany).mockResolvedValue({ count: 3 });
        const r = await retryBroadcast(ID);
        expect(r.requeued).toBe(3);
        const args = m(prisma.broadcastMessage.updateMany).mock.calls[0][0];
        expect(args.where).toEqual({ broadcastId: ID, status: 'FAILED' });
        expect(args.data).toMatchObject({ status: 'PENDING', attempts: 0, error: null });
    });
    it('answers not found for a bad id', async () => {
        await expect(retryBroadcast('nope')).rejects.toThrow('Broadcast not found');
    });
});
